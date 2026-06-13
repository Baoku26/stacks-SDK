import { useMemo } from 'react';
import { useSbtcContext } from '../provider/context';
import { fetchJson } from '../utils/http';
import { usePolledResource } from './usePolledResource';
import type { SbtcError } from '../errors';

/** STX has 6 decimals (1 STX = 1,000,000 µSTX). */
const USTX_PER_STX = 1_000_000n;

/** Format µSTX as a trimmed STX string with unit, e.g. `1234567n` → `'1.234567 STX'`. */
function formatStx(microStx: bigint): string {
  const whole = microStx / USTX_PER_STX;
  const frac = (microStx % USTX_PER_STX).toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole.toString()}${frac ? `.${frac}` : ''} STX`;
}

/** Hiro node RPC `GET /v2/accounts/{principal}` (balance/locked are hex strings). */
interface HiroAccount {
  balance: string;
  locked: string;
  nonce: number;
}

export interface UseStxBalanceResult {
  /** Total STX balance in µSTX, or `null` before the first load. */
  microStx: bigint | null;
  /** Formatted STX string (e.g. `'1.234567 STX'`), or `null` before the first load. */
  stx: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: SbtcError | null;
  refresh: () => void;
}

/**
 * Live STX balance for `address` (FR-7.2). Polls every `pollIntervalMs` (default
 * 30s). SSR-safe; returns the loading state until the first client fetch settles.
 */
export function useStxBalance(
  address: string | null | undefined,
  options?: { pollIntervalMs?: number },
): UseStxBalanceResult {
  const { apiConfig, adapter } = useSbtcContext();

  const fetcher = useMemo(() => {
    if (!address) return null;
    const base = apiConfig.hiroApiUrl.replace(/\/$/, '');
    return async (): Promise<bigint> => {
      const account = await fetchJson<HiroAccount>(`${base}/v2/accounts/${address}?proof=0`, {
        platform: adapter.platform,
      });
      return BigInt(account.balance);
    };
  }, [address, apiConfig.hiroApiUrl, adapter.platform]);

  const { data, isLoading, isRefreshing, error, refresh } = usePolledResource<bigint>(
    fetcher,
    options?.pollIntervalMs ?? 30_000,
  );

  return {
    microStx: data,
    stx: data === null ? null : formatStx(data),
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
