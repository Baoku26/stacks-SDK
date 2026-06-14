import { useCallback, useMemo, useState } from 'react';
import { hex } from '@scure/base';
import {
  type ClarityValue,
  cvToValue,
  makeUnsignedContractCall,
  serializeCV,
  serializeTransaction,
} from '@stacks/transactions';
import { SbtcError, SbtcErrorCode } from '../errors';
import { useSbtcContext } from '../provider/context';
import { broadcastStacksTx, callReadOnly, fetchStacksNonce } from './stacksNode';
import { usePolledResource } from './usePolledResource';

/** Default Stacks tx fee (µSTX) for `call()` — tunable per call via `options.fee`. */
const DEFAULT_STX_FEE = 10_000;

/** Read-only query auto-evaluated on mount and by `refetch()` (FR-10.1). */
export interface ReadOnlyQuery {
  /** Read-only function name. */
  fn: string;
  /** Clarity arguments. */
  args?: ClarityValue[];
  /** Principal the node evaluates as `tx-sender`. Defaults to the contract address. */
  sender?: string;
}

/** Per-call overrides for a state-changing `call()`. */
export interface ContractCallOptions {
  /** Stacks transaction fee in µSTX. Default 10,000. */
  fee?: number | bigint;
  /** Override the signer for this call. Defaults to config `signTx` / `adapter.connect.signStacksTx`. */
  signTx?: (tx: Uint8Array) => Promise<Uint8Array>;
}

export interface UseStacksContractConfig {
  /** Contract id `"<stxAddress>.<contract-name>"`. */
  contract: string;
  /** Optional read-only query, evaluated on mount and re-run by `refetch()`. */
  readOnly?: ReadOnlyQuery;
  /** Required to send a state-changing `call()` (builds + pays for the tx). */
  sender?: { address: string; publicKey: string };
  /** Default signer for `call()`; overridable per call. Defaults to `adapter.connect.signStacksTx`. */
  signTx?: (tx: Uint8Array) => Promise<Uint8Array>;
}

export interface UseStacksContractResult<T = unknown> {
  /** Decoded read-only result (JS value via `cvToValue`), or `null` (FR-10.3). */
  data: T | null;
  /** True until the first read-only query settles. */
  isLoading: boolean;
  /** True during a `refetch()` after data already exists. */
  isRefreshing: boolean;
  /** Last read-only OR `call()` error (single field per FR-10.3); `null` when clear. */
  error: SbtcError | null;
  /** Re-run the read-only query (FR-10.3). No-op when no `readOnly` is configured. */
  refetch: () => void;
  /**
   * Build → sign → broadcast a state-changing contract call (FR-10.2). Resolves to
   * the Stacks txid on success, or `null` on failure (the error is surfaced via the
   * `error` field — the hook never throws, per the SDK hook contract).
   */
  call: (fn: string, args?: ClarityValue[], options?: ContractCallOptions) => Promise<string | null>;
}

/**
 * Clarity read-only calls + a contract-call builder, platform-agnostic (FR-10).
 *
 * Read-only: pass `config.readOnly` and read `data` / `isLoading` / `error`;
 * `refetch()` re-runs it. Decoding uses `cvToValue` (JSON-compatible).
 *
 * State-changing: `call(fn, args, options)` builds an unsigned contract call,
 * signs it via `adapter.connect.signStacksTx` (or a `signTx` override, FR-10.2),
 * broadcasts to the Hiro node, and resolves to the Stacks txid. Requires
 * `config.sender` ({ address, publicKey }).
 *
 * NOTE: `config` is read every render; memoise it (or keep `readOnly.args` stable)
 * caller-side. The read-only fetcher is keyed on the contract id, fn, sender, and a
 * value-signature of the args, so equal-valued args won't re-trigger fetches.
 */
export function useStacksContract<T = unknown>(
  config: UseStacksContractConfig,
): UseStacksContractResult<T> {
  const { adapter, apiConfig, network } = useSbtcContext();
  const { contract, readOnly, sender, signTx } = config;

  const dot = contract.indexOf('.');
  const contractAddress = dot === -1 ? contract : contract.slice(0, dot);
  const contractName = dot === -1 ? '' : contract.slice(dot + 1);

  const [callError, setCallError] = useState<SbtcError | null>(null);

  const roFn = readOnly?.fn;
  const roSender = readOnly?.sender;
  const roArgs = readOnly?.args;
  // Value-signature so equal-valued arg arrays produce a stable fetcher identity
  // (consumers commonly inline `args`, which would otherwise refetch every render).
  const argsSig = roArgs ? roArgs.map((a) => serializeCV(a)).join(',') : '';

  const fetcher = useMemo(() => {
    if (roFn === undefined) return null;
    return async (): Promise<T> => {
      const cv = await callReadOnly(
        apiConfig,
        contract,
        roFn,
        roArgs ?? [],
        roSender ?? contractAddress,
        adapter.platform,
      );
      return cvToValue(cv, true) as T;
    };
    // `roArgs` is tracked via `argsSig` (value, not identity).
  }, [apiConfig, contract, contractAddress, adapter.platform, roFn, roSender, argsSig, roArgs]);

  const {
    data,
    isLoading,
    isRefreshing,
    error: readError,
    refresh,
  } = usePolledResource<T>(fetcher);

  const call = useCallback(
    async (
      fn: string,
      args: ClarityValue[] = [],
      options?: ContractCallOptions,
    ): Promise<string | null> => {
      setCallError(null);
      try {
        if (dot === -1) {
          throw new SbtcError({
            code: SbtcErrorCode.TX_SIGNING_FAILED,
            message: `Invalid contract id "${contract}" — expected "<address>.<name>".`,
            platform: adapter.platform,
            context: { contract },
          });
        }
        if (!sender) {
          throw new SbtcError({
            code: SbtcErrorCode.WALLET_NOT_FOUND,
            message: 'useStacksContract.call() requires `sender` ({ address, publicKey }) in config.',
            platform: adapter.platform,
          });
        }

        const signFn = options?.signTx ?? signTx ?? adapter.connect.signStacksTx.bind(adapter.connect);
        const nonce = await fetchStacksNonce(apiConfig, sender.address, adapter.platform);

        const tx = await makeUnsignedContractCall({
          contractAddress,
          contractName,
          functionName: fn,
          functionArgs: args,
          publicKey: sender.publicKey,
          network,
          fee: options?.fee ?? DEFAULT_STX_FEE,
          nonce,
        });

        const signed = await signFn(hex.decode(serializeTransaction(tx)));
        return await broadcastStacksTx(apiConfig, signed, adapter.platform);
      } catch (e) {
        const err =
          e instanceof SbtcError
            ? e
            : new SbtcError({
                code: SbtcErrorCode.TX_SIGNING_FAILED,
                originalError: e,
                platform: adapter.platform,
              });
        setCallError(err);
        return null;
      }
    },
    [adapter, apiConfig, network, sender, signTx, contract, contractAddress, contractName, dot],
  );

  const refetch = useCallback(() => {
    setCallError(null);
    refresh();
  }, [refresh]);

  return {
    data,
    isLoading,
    isRefreshing,
    error: callError ?? readError,
    refetch,
    call,
  };
}
