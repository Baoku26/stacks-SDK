import type { AuthAdapter, ConnectAdapter, PlatformAdapter, StorageAdapter } from '../types';

const notImplemented = (): never => {
  throw new Error('WebAdapter not yet implemented');
};

/**
 * Browser adapter. STUB for M1 (T018); implemented across M3 —
 * `localStorage` + AES-GCM (T034), WebAuthn + passphrase fallback (T035),
 * `@stacks/connect` (T036), assembled in T037.
 *
 * BUNDLE SEPARATION (do not regress): the real implementation MUST load
 * `@stacks/connect` via dynamic `import()` inside methods, NOT a static top-level
 * import. `detect.ts` references both WebAdapter and NativeAdapter, so a static
 * `import '@stacks/connect'` here would be pulled into native bundles. See
 * MEMORY.md → [ADAPTERS] tree-shaking.
 */
export class WebAdapter implements PlatformAdapter {
  readonly platform = 'web' as const;

  readonly storage: StorageAdapter = {
    get: async () => notImplemented(),
    set: async () => notImplemented(),
    remove: async () => notImplemented(),
  };

  readonly auth: AuthAdapter = {
    isAvailable: async () => notImplemented(),
    prompt: async () => notImplemented(),
  };

  readonly connect: ConnectAdapter = {
    signPsbt: async () => notImplemented(),
    signStacksTx: async () => notImplemented(),
    getAvailableWallets: async () => notImplemented(),
  };
}
