import { useMemo } from 'react';
import { useSbtcContext } from '../provider/context';
import { fetchJson } from '../utils/http';
import { usePolledResource } from './usePolledResource';
import type { SbtcError } from '../errors';

/** Hiro node RPC `GET /v2/accounts/{principal}` — `nonce` is the next (pending) nonce. */
interface HiroAccount {
  nonce: number;
}

export interface UseNonceResult {
  /** The account's pending nonce, or `null` before the first load. */
  nonce: number | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: SbtcError | null;
  /** Re-fetch the nonce. Call this immediately before building a transaction. */
  refresh: () => void;
}

/**
 * Pending account nonce for `address` (FR-7.3). Always fetched fresh from the
 * Hiro API and never cached — `/v2/accounts` returns the pending nonce (confirmed
 * + mempool), which is correct for sequential transactions (MEMORY.md →
 * [CONTRACTS] Nonce must always be fetched fresh). No polling; call `refresh()`
 * right before sending a tx. SSR-safe.
 */
export function useNonce(address: string | null | undefined): UseNonceResult {
  const { apiConfig, adapter } = useSbtcContext();

  const fetcher = useMemo(() => {
    if (!address) return null;
    const base = apiConfig.hiroApiUrl.replace(/\/$/, '');
    return async (): Promise<number> => {
      const account = await fetchJson<HiroAccount>(`${base}/v2/accounts/${address}?proof=0`, {
        platform: adapter.platform,
      });
      return account.nonce;
    };
  }, [address, apiConfig.hiroApiUrl, adapter.platform]);

  const { data, isLoading, isRefreshing, error, refresh } = usePolledResource<number>(fetcher);

  return { nonce: data, isLoading, isRefreshing, error, refresh };
}
