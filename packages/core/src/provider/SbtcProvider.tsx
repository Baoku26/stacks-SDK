import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { detectAdapter } from '../adapters/detect';
import { SbtcError, SbtcErrorCode } from '../errors';
import { resolveApiConfig } from '../utils/network';
import { SbtcContext } from './context';
import type { SbtcContextValue, SbtcProviderProps } from './types';

/**
 * Root provider for `@sbtc/sdk`. Auto-detects the platform adapter (unless one is
 * passed), resolves API endpoints, and provides the context every hook reads.
 *
 *   <SbtcProvider network="mainnet">{children}</SbtcProvider>
 *
 * - Auto-detects native / web / SSR via `detectAdapter()` (FR-1.1); pass `adapter`
 *   to override (FR-1.2).
 * - On native without polyfills (`global.Buffer` missing) throws
 *   `POLYFILL_NOT_INITIALIZED` (FR-1.6). The check is skipped on web and SSR
 *   (the SSR adapter reports `platform: 'web'`).
 */
export function SbtcProvider({
  network,
  adapter,
  apiConfig,
  children,
}: SbtcProviderProps): ReactElement {
  const resolvedAdapter = useMemo(() => adapter ?? detectAdapter(), [adapter]);

  // FR-1.6: native polyfill guard. Native only — web/SSR adapters report 'web'.
  if (
    resolvedAdapter.platform === 'native' &&
    typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined'
  ) {
    throw new SbtcError({
      code: SbtcErrorCode.POLYFILL_NOT_INITIALIZED,
      platform: 'native',
    });
  }

  const value = useMemo<SbtcContextValue>(
    () => ({
      network,
      adapter: resolvedAdapter,
      apiConfig: resolveApiConfig(network, apiConfig),
    }),
    [network, resolvedAdapter, apiConfig],
  );

  return <SbtcContext.Provider value={value}>{children}</SbtcContext.Provider>;
}
