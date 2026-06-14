import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Transaction } from '@scure/btc-signer';
import { hex } from '@scure/base';
import { sbtcDepositHelper } from 'sbtc';
import { SbtcError, SbtcErrorCode } from '../errors';
import { useSbtcContext } from '../provider/context';
import { broadcastRawTx, createSbtcApiClient, sbtcNetwork, mapEmilyStatus } from './emily';
import { DepositStatus } from './types';

/** sBTC deposit contract minimum (MEMORY.md → [SBTC] Dust limit). */
const DUST_LIMIT_SATS = 546;
const DEFAULT_POLL_MS = 15_000;
const MAX_BACKOFF_MS = 300_000;

export interface UseSbtcDepositConfig {
  /** Recipient Stacks address that will receive the minted sBTC. */
  stacksAddress: string;
  /** Bitcoin address funding the deposit and receiving change. */
  bitcoinAddress: string;
  /** Compressed public key (hex) controlling the funding UTXOs. */
  paymentPublicKey: string;
  /** Public key (hex) allowed to reclaim if the deposit is never processed. Defaults to `paymentPublicKey`. */
  reclaimPublicKey?: string;
  /** Fee tier for the Bitcoin transaction. Default `'medium'`. */
  feeRate?: 'low' | 'medium' | 'high';
  /** Cap on the fee the sBTC signers may take, in sats. */
  maxSignerFee?: number;
  /** Override the signer. Defaults to `adapter.connect.signPsbt` (FR-8.2). */
  signPsbt?: (psbt: Uint8Array) => Promise<Uint8Array>;
  /** Emily poll interval while pending. Default 15s (FR-8.3). */
  pollIntervalMs?: number;
  onSuccess?: (bitcoinTxid: string) => void;
  onError?: (error: SbtcError) => void;
}

export interface UseSbtcDepositResult {
  /** Build → sign → broadcast → notify Emily, then poll in the background. */
  deposit: (amountSats: number | bigint) => Promise<void>;
  status: DepositStatus;
  /** Bitcoin txid, once broadcast. */
  txid: string | null;
  /** The P2TR deposit address the BTC was sent to. */
  depositAddress: string | null;
  error: SbtcError | null;
  /** Reset to idle and stop polling. */
  reset: () => void;
}

/**
 * Deposit BTC → sBTC (FR-8). Builds the deposit with the official `sbtc` package,
 * signs the PSBT via `adapter.connect.signPsbt` (or a `signPsbt` override),
 * broadcasts, notifies Emily, then polls deposit status with backoff. The status
 * machine stays in `FAILED` until `reset()` (PRD §11.1). Note: Emily may also
 * reject deposits below its `perDepositMinimum` (1000 sats on mainnet) even though
 * they clear the 546-sat dust check — that surfaces as an `EMILY_API_ERROR`.
 */
export function useSbtcDeposit(config: UseSbtcDepositConfig): UseSbtcDepositResult {
  const { adapter, apiConfig, network } = useSbtcContext();
  const [status, setStatus] = useState<DepositStatus>(DepositStatus.IDLE);
  const [txid, setTxid] = useState<string | null>(null);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [error, setError] = useState<SbtcError | null>(null);

  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const configRef = useRef(config);
  configRef.current = config;

  const client = useMemo(
    () => createSbtcApiClient(apiConfig, network, adapter.platform),
    [apiConfig.emilyApiUrl, apiConfig.bitcoinApiUrl, apiConfig.hiroApiUrl, network, adapter.platform],
  );

  const clearPoll = useCallback(() => {
    if (pollRef.current !== undefined) {
      clearTimeout(pollRef.current);
      pollRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPoll();
    };
  }, [clearPoll]);

  const fail = useCallback(
    (e: unknown) => {
      const err =
        e instanceof SbtcError
          ? e
          : new SbtcError({
              code: SbtcErrorCode.EMILY_API_ERROR,
              // Surface the real cause (e.g. a `NoSuchContract` from a stale sBTC
              // deployer, a fee/UTXO fetch failure) rather than the generic default.
              // Only build/network/contract errors reach here — no key material (SR-2).
              message: e instanceof Error ? e.message : typeof e === 'string' ? e : undefined,
              originalError: e,
              platform: adapter.platform,
            });
      if (!mountedRef.current) return;
      setError(err);
      setStatus(DepositStatus.FAILED);
      configRef.current.onError?.(err);
    },
    [adapter.platform],
  );

  const pollEmily = useCallback(
    (bitcoinTxid: string) => {
      let failures = 0;
      const interval = (): number => configRef.current.pollIntervalMs ?? DEFAULT_POLL_MS;

      const tick = async (): Promise<void> => {
        try {
          const res = await client.fetchDeposit(bitcoinTxid);
          if (!mountedRef.current) return;
          const outcome = mapEmilyStatus(res.status);
          if (outcome === 'confirmed') {
            setStatus(DepositStatus.CONFIRMED);
            configRef.current.onSuccess?.(bitcoinTxid);
            return;
          }
          if (outcome === 'failed') {
            fail(
              new SbtcError({
                code: SbtcErrorCode.EMILY_API_ERROR,
                message: res.statusMessage || 'The sBTC deposit failed.',
                platform: adapter.platform,
                context: { status: res.status },
              }),
            );
            return;
          }
          failures = 0;
          pollRef.current = setTimeout(() => void tick(), interval());
        } catch {
          // A polling blip is not a deposit failure (PRD §11.1) — back off and retry.
          if (!mountedRef.current) return;
          failures += 1;
          pollRef.current = setTimeout(
            () => void tick(),
            Math.min(interval() * 2 ** failures, MAX_BACKOFF_MS),
          );
        }
      };

      pollRef.current = setTimeout(() => void tick(), interval());
    },
    [client, fail, adapter.platform],
  );

  const deposit = useCallback(
    async (amountSats: number | bigint) => {
      const amount = Number(amountSats);
      clearPoll();
      setError(null);
      setTxid(null);
      setDepositAddress(null);

      if (!Number.isFinite(amount) || amount < DUST_LIMIT_SATS) {
        fail(
          new SbtcError({
            code: SbtcErrorCode.DEPOSIT_BELOW_DUST,
            message: `Deposit amount ${amount} sats is below the ${DUST_LIMIT_SATS} sat minimum.`,
            platform: adapter.platform,
          }),
        );
        return;
      }

      const cfg = configRef.current;
      const signFn = cfg.signPsbt ?? adapter.connect.signPsbt.bind(adapter.connect);

      try {
        setStatus(DepositStatus.BUILDING);
        const [signersPublicKey, utxos, feeRate] = await Promise.all([
          client.fetchSignersPublicKey(),
          client.fetchUtxos(cfg.bitcoinAddress),
          client.fetchFeeRate(cfg.feeRate ?? 'medium'),
        ]);

        const built = await sbtcDepositHelper({
          network: sbtcNetwork(network),
          amountSats: amount,
          stacksAddress: cfg.stacksAddress,
          bitcoinChangeAddress: cfg.bitcoinAddress,
          signersPublicKey,
          reclaimPublicKey: cfg.reclaimPublicKey ?? cfg.paymentPublicKey,
          paymentPublicKey: cfg.paymentPublicKey,
          feeRate,
          utxos,
          maxSignerFee: cfg.maxSignerFee,
        });
        if (!mountedRef.current) return;
        setDepositAddress(built.address);

        setStatus(DepositStatus.SIGNING);
        const signed = await signFn(built.transaction.toPSBT());
        if (!mountedRef.current) return;

        setStatus(DepositStatus.BROADCASTING);
        // Parse/finalize/extract with OUR @scure/btc-signer (v2); broadcast + notify
        // with the raw hex so no v2 `Transaction` crosses the sbtc (v1) boundary.
        const signedTx = Transaction.fromPSBT(signed);
        try {
          signedTx.finalize();
        } catch {
          // The wallet may return an already-finalized transaction.
        }
        const rawTxHex = hex.encode(signedTx.extract());
        const bitcoinTxid = await broadcastRawTx(apiConfig, rawTxHex, adapter.platform);
        await client.notifySbtc({
          depositScript: built.depositScript,
          reclaimScript: built.reclaimScript,
          vout: 0,
          transaction: rawTxHex,
        });
        if (!mountedRef.current) return;

        setTxid(bitcoinTxid);
        setStatus(DepositStatus.PENDING);
        pollEmily(bitcoinTxid);
      } catch (e) {
        fail(e);
      }
    },
    [adapter, apiConfig, client, network, clearPoll, fail, pollEmily],
  );

  const reset = useCallback(() => {
    clearPoll();
    setStatus(DepositStatus.IDLE);
    setTxid(null);
    setDepositAddress(null);
    setError(null);
  }, [clearPoll]);

  return { deposit, status, txid, depositAddress, error, reset };
}
