import { useCallback, useEffect, useRef, useState } from 'react';
import { hex } from '@scure/base';
import { Address, NETWORK, TEST_NETWORK } from '@scure/btc-signer';
import {
  makeUnsignedContractCall,
  serializeTransaction,
  bufferCV,
  tupleCV,
  uintCV,
} from '@stacks/transactions';
import { SbtcError, SbtcErrorCode } from '../errors';
import { useSbtcContext } from '../provider/context';
import { isValidBtcAddress } from '../utils/address';
import {
  broadcastStacksTx,
  fetchStacksNonce,
  fetchWithdrawalStatus,
  mapEmilyStatus,
} from './emily';
import { WithdrawalStatus } from './types';

const DEFAULT_POLL_MS = 15_000;
const MAX_BACKOFF_MS = 300_000;
/** Static per FR-9.4 / MEMORY [SBTC] Withdrawal confirmation time (~6 BTC blocks). */
const ESTIMATED_CONFIRMATION_MINUTES = 60;
/** Default Stacks tx fee (µSTX) — tunable; bump on mainnet congestion. */
const DEFAULT_STX_FEE = 10_000;
/** Default max BTC fee (sats) the signers may spend fulfilling the withdrawal — tunable. */
const DEFAULT_MAX_FEE = 80_000;

export interface UseSbtcWithdrawConfig {
  /** Stacks address initiating the withdrawal (sender + fee payer). */
  stacksAddress: string;
  /** Sender's Stacks public key (hex) — used to build the unsigned contract call. */
  stacksPublicKey: string;
  /** Max BTC fee (sats) the sBTC signers may take for the sweep. Default 80,000. */
  maxFee?: number;
  /** Stacks transaction fee in µSTX. Default 10,000. */
  fee?: number | bigint;
  /** Override the signer. Defaults to `adapter.connect.signStacksTx` (FR-9.2). */
  signTx?: (tx: Uint8Array) => Promise<Uint8Array>;
  /** Emily poll interval while pending. Default 15s. */
  pollIntervalMs?: number;
  onSuccess?: (bitcoinTxid: string) => void;
  onError?: (error: SbtcError) => void;
}

export interface UseSbtcWithdrawResult {
  /** Build → sign → broadcast the Stacks request, then poll Emily for BTC release. */
  withdraw: (amountSats: number | bigint, btcAddress: string) => Promise<void>;
  status: WithdrawalStatus;
  /** Stacks txid of the withdrawal request, once broadcast. */
  stacksTxid: string | null;
  /** Bitcoin txid of the released funds, once Emily reports confirmation. */
  btcTxid: string | null;
  /** Static estimate users can show: ~60 min (≈6 BTC confirmations). */
  estimatedConfirmationMinutes: number;
  error: SbtcError | null;
  reset: () => void;
}

/** PoX-style `{ version, hashbytes }` for a Bitcoin address (sBTC withdrawal recipient). */
function btcAddressToRecipient(
  address: string,
  network: 'mainnet' | 'testnet',
): { version: Uint8Array; hashbytes: Uint8Array } {
  const decoded = Address(network === 'mainnet' ? NETWORK : TEST_NETWORK).decode(address);
  const bad = (): never => {
    throw new SbtcError({ code: SbtcErrorCode.INVALID_BTC_ADDRESS, context: { address } });
  };
  if (decoded === undefined) return bad();
  switch (decoded.type) {
    case 'pkh':
      return { version: Uint8Array.of(0x00), hashbytes: decoded.hash };
    case 'sh':
      return { version: Uint8Array.of(0x01), hashbytes: decoded.hash };
    case 'wpkh':
      return { version: Uint8Array.of(0x04), hashbytes: decoded.hash };
    case 'wsh':
      return { version: Uint8Array.of(0x05), hashbytes: decoded.hash };
    case 'tr':
      return { version: Uint8Array.of(0x06), hashbytes: decoded.pubkey };
    default:
      return bad();
  }
}

/**
 * Withdraw sBTC → BTC (FR-9). Builds an `initiate-withdrawal-request` contract
 * call to the sBTC withdrawal contract, signs it via `adapter.connect.signStacksTx`
 * (or a `signTx` override), broadcasts to the Stacks node, then polls Emily for the
 * BTC release (~60 min). Status machine stays `FAILED` until `reset()` (PRD §11.1).
 *
 * The recipient BTC address is validated (FR-9.1) and encoded to the contract's
 * `{ version, hashbytes }` PoX tuple. The withdrawal contract id comes from
 * `apiConfig.sbtcWithdrawalContract` (override it on testnet — see MEMORY [SBTC]
 * testnet deployment churn).
 */
export function useSbtcWithdraw(config: UseSbtcWithdrawConfig): UseSbtcWithdrawResult {
  const { adapter, apiConfig, network } = useSbtcContext();
  const [status, setStatus] = useState<WithdrawalStatus>(WithdrawalStatus.IDLE);
  const [stacksTxid, setStacksTxid] = useState<string | null>(null);
  const [btcTxid, setBtcTxid] = useState<string | null>(null);
  const [error, setError] = useState<SbtcError | null>(null);

  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const configRef = useRef(config);
  configRef.current = config;

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
              // deployer, a broadcast/nonce failure) rather than the generic default.
              // Only build/network/contract errors reach here — no key material (SR-2).
              message: e instanceof Error ? e.message : typeof e === 'string' ? e : undefined,
              originalError: e,
              platform: adapter.platform,
            });
      if (!mountedRef.current) return;
      setError(err);
      setStatus(WithdrawalStatus.FAILED);
      configRef.current.onError?.(err);
    },
    [adapter.platform],
  );

  const pollEmily = useCallback(
    (sTxid: string) => {
      let failures = 0;
      const interval = (): number => configRef.current.pollIntervalMs ?? DEFAULT_POLL_MS;

      const tick = async (): Promise<void> => {
        try {
          const res = await fetchWithdrawalStatus(apiConfig, sTxid, adapter.platform);
          if (!mountedRef.current) return;
          const outcome = mapEmilyStatus(res.status);
          if (outcome === 'confirmed') {
            if (res.bitcoinTxid !== undefined) setBtcTxid(res.bitcoinTxid);
            setStatus(WithdrawalStatus.CONFIRMED);
            if (res.bitcoinTxid !== undefined) configRef.current.onSuccess?.(res.bitcoinTxid);
            return;
          }
          if (outcome === 'failed') {
            fail(
              new SbtcError({
                code: SbtcErrorCode.EMILY_API_ERROR,
                message: res.statusMessage || 'The sBTC withdrawal failed.',
                platform: adapter.platform,
                context: { status: res.status },
              }),
            );
            return;
          }
          failures = 0;
          pollRef.current = setTimeout(() => void tick(), interval());
        } catch {
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
    [apiConfig, adapter.platform, fail],
  );

  const withdraw = useCallback(
    async (amountSats: number | bigint, btcAddress: string) => {
      clearPoll();
      setError(null);
      setStacksTxid(null);
      setBtcTxid(null);

      if (!isValidBtcAddress(btcAddress, network)) {
        fail(
          new SbtcError({
            code: SbtcErrorCode.INVALID_BTC_ADDRESS,
            platform: adapter.platform,
            context: { btcAddress },
          }),
        );
        return;
      }

      const cfg = configRef.current;
      const signFn = cfg.signTx ?? adapter.connect.signStacksTx.bind(adapter.connect);

      try {
        setStatus(WithdrawalStatus.BUILDING);
        const recipient = btcAddressToRecipient(btcAddress, network);
        const dot = apiConfig.sbtcWithdrawalContract.indexOf('.');
        const contractAddress = apiConfig.sbtcWithdrawalContract.slice(0, dot);
        const contractName = apiConfig.sbtcWithdrawalContract.slice(dot + 1);
        const nonce = await fetchStacksNonce(apiConfig, cfg.stacksAddress, adapter.platform);

        const tx = await makeUnsignedContractCall({
          contractAddress,
          contractName,
          functionName: 'initiate-withdrawal-request',
          functionArgs: [
            uintCV(BigInt(amountSats)),
            tupleCV({
              version: bufferCV(recipient.version),
              hashbytes: bufferCV(recipient.hashbytes),
            }),
            uintCV(cfg.maxFee ?? DEFAULT_MAX_FEE),
          ],
          publicKey: cfg.stacksPublicKey,
          network,
          fee: cfg.fee ?? DEFAULT_STX_FEE,
          nonce,
        });
        if (!mountedRef.current) return;

        setStatus(WithdrawalStatus.SIGNING);
        const signed = await signFn(hex.decode(serializeTransaction(tx)));
        if (!mountedRef.current) return;

        setStatus(WithdrawalStatus.BROADCASTING);
        const sTxid = await broadcastStacksTx(apiConfig, signed, adapter.platform);
        if (!mountedRef.current) return;

        setStacksTxid(sTxid);
        setStatus(WithdrawalStatus.PENDING);
        pollEmily(sTxid);
      } catch (e) {
        fail(e);
      }
    },
    [adapter, apiConfig, network, clearPoll, fail, pollEmily],
  );

  const reset = useCallback(() => {
    clearPoll();
    setStatus(WithdrawalStatus.IDLE);
    setStacksTxid(null);
    setBtcTxid(null);
    setError(null);
  }, [clearPoll]);

  return {
    withdraw,
    status,
    stacksTxid,
    btcTxid,
    estimatedConfirmationMinutes: ESTIMATED_CONFIRMATION_MINUTES,
    error,
    reset,
  };
}
