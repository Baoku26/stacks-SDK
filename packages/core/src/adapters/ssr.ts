import { SbtcError, SbtcErrorCode } from '../errors';
import type { AuthAdapter, ConnectAdapter, PlatformAdapter, StorageAdapter } from './types';

const ssrUnsupported = (): never => {
  throw new SbtcError({ code: SbtcErrorCode.SSR_NOT_SUPPORTED });
};

/**
 * No-op adapter used during server-side rendering (Next.js, no `window`).
 *
 * Storage is a complete no-op (get → null); auth/connect throw
 * `SSR_NOT_SUPPORTED`. Hooks fast-path on `typeof window === 'undefined'` and
 * return safe loading states BEFORE ever touching the adapter (PRD SR-9, FR-1.5),
 * so these methods are a defensive backstop. Reports `platform: 'web'`.
 */
export class SsrAdapter implements PlatformAdapter {
  readonly platform = 'web' as const;

  readonly storage: StorageAdapter = {
    get: async () => null,
    set: async () => {},
    remove: async () => {},
  };

  readonly auth: AuthAdapter = {
    isAvailable: async () => false,
    prompt: async () => ssrUnsupported(),
  };

  readonly connect: ConnectAdapter = {
    signPsbt: async () => ssrUnsupported(),
    signStacksTx: async () => ssrUnsupported(),
    getAvailableWallets: async () => [],
  };
}
