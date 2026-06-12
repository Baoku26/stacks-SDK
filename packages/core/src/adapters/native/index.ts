import type { AuthAdapter, ConnectAdapter, PlatformAdapter, StorageAdapter } from '../types';

const notImplemented = (): never => {
  throw new Error('NativeAdapter not yet implemented');
};

/**
 * React Native / Expo adapter. STUB for M1 (T017); implemented across M2 —
 * `expo-secure-store` (T025), `expo-local-authentication` (T026), Leather/Xverse
 * deep-links (T027), assembled in T028.
 *
 * BUNDLE SEPARATION (do not regress): the real implementation MUST load its
 * platform packages via dynamic `import()` inside methods, NOT static top-level
 * imports. `detect.ts` references both NativeAdapter and WebAdapter, so a static
 * `import 'expo-secure-store'` here would be pulled into web bundles (where it
 * isn't installed) and break the web build. See MEMORY.md → [ADAPTERS] tree-shaking.
 */
export class NativeAdapter implements PlatformAdapter {
  readonly platform = 'native' as const;

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
