import { useCallback, useEffect, useRef, useState } from 'react';
import { SbtcError, SbtcErrorCode } from '../errors';

/** Shared return shape for the read-only account hooks (PRD FR-7.4). */
export interface PolledResource<T> {
  data: T | null;
  /** True until the first fetch settles (or whenever the inputs change). */
  isLoading: boolean;
  /** True during a poll tick or an explicit `refresh()` after data already exists. */
  isRefreshing: boolean;
  error: SbtcError | null;
  /** Force an immediate fresh fetch. */
  refresh: () => void;
}

/** Backoff ceiling for failed polls (NFR-1.4: 15s → … → 300s max). */
const MAX_BACKOFF_MS = 300_000;

function toSbtcError(error: unknown): SbtcError {
  return error instanceof SbtcError
    ? error
    : new SbtcError({ code: SbtcErrorCode.NETWORK_TIMEOUT, originalError: error });
}

/**
 * Internal engine for `useStxBalance` / `useNonce` / `useSbtcBalance`. Fetches on
 * mount and whenever `fetcher` identity changes (callers memoise it on
 * address/url); optionally polls at `pollIntervalMs` with exponential backoff on
 * error. `fetcher === null` ⇒ idle (no fetch, not loading) for missing inputs.
 *
 * SSR-safe: all fetching happens inside `useEffect` (never on the server), so the
 * server render is the initial state and matches the client's first render
 * (NFR-4.1 / 4.3). Not barrel-exported.
 */
export function usePolledResource<T>(
  fetcher: (() => Promise<T>) | null,
  pollIntervalMs?: number,
): PolledResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(fetcher !== null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<SbtcError | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let hasData = false;

    // Reset to a clean loading state for the new inputs.
    setData(null);
    setError(null);
    setIsRefreshing(false);
    setIsLoading(fetcherRef.current !== null);

    const schedule = () => {
      if (pollIntervalMs === undefined || pollIntervalMs <= 0) return;
      const delay =
        failures > 0 ? Math.min(pollIntervalMs * 2 ** failures, MAX_BACKOFF_MS) : pollIntervalMs;
      timer = setTimeout(() => void run(false), delay);
    };

    const run = async (manual: boolean) => {
      const fn = fetcherRef.current;
      if (fn === null) {
        setIsLoading(false);
        return;
      }
      if (manual || hasData) setIsRefreshing(true);
      try {
        const result = await fn();
        if (cancelled) return;
        setData(result);
        setError(null);
        hasData = true;
        failures = 0;
      } catch (e) {
        if (cancelled) return;
        setError(toSbtcError(e));
        failures += 1;
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
          schedule();
        }
      }
    };

    refreshRef.current = () => void run(true);
    void run(false);

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [fetcher, pollIntervalMs]);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { data, isLoading, isRefreshing, error, refresh };
}
