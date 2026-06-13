import { useMemo } from 'react';
import { useSbtcContext } from '../provider/context';
import { fetchJson } from '../utils/http';
import { satsToBtc } from '../utils/format';
import { usePolledResource } from '../contracts/usePolledResource';
import type { SbtcError } from '../errors';

/** Hiro extended `GET /extended/v1/address/{principal}/balances`. */
interface HiroBalances {
  fungible_tokens?: Record<string, { balance: string }>;
}

export interface UseSbtcBalanceResult {
  /** sBTC balance in satoshis (1 sBTC = 1 BTC = 1e8 sats), or `null` before first load. */
  sats: bigint | null;
  /** Formatted BTC string with unit (e.g. `'0.0012 BTC'`), or `null` before first load. */
  btc: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: SbtcError | null;
  refresh: () => void;
}

/**
 * Live sBTC balance for `address` (FR-7.1). Reads the SIP-010 sBTC token balance
 * from the Hiro fungible-token balances endpoint, keyed by
 * `apiConfig.sbtcTokenAssetId` (verified token id — see MEMORY.md → [DATA]).
 * Polls every `pollIntervalMs` (default 30s) with backoff on error. SSR-safe.
 */
export function useSbtcBalance(
  address: string | null | undefined,
  options?: { pollIntervalMs?: number },
): UseSbtcBalanceResult {
  const { apiConfig, adapter } = useSbtcContext();

  const fetcher = useMemo(() => {
    if (!address) return null;
    const base = apiConfig.hiroApiUrl.replace(/\/$/, '');
    const assetId = apiConfig.sbtcTokenAssetId;
    return async (): Promise<bigint> => {
      const balances = await fetchJson<HiroBalances>(
        `${base}/extended/v1/address/${address}/balances`,
        { platform: adapter.platform },
      );
      const entry = balances.fungible_tokens?.[assetId];
      return entry === undefined ? 0n : BigInt(entry.balance);
    };
  }, [address, apiConfig.hiroApiUrl, apiConfig.sbtcTokenAssetId, adapter.platform]);

  const { data, isLoading, isRefreshing, error, refresh } = usePolledResource<bigint>(
    fetcher,
    options?.pollIntervalMs ?? 30_000,
  );

  return {
    sats: data,
    btc: data === null ? null : `${satsToBtc(data)} BTC`,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
