import type { AuthAdapter, ConnectAdapter, PlatformAdapter, StorageAdapter } from '../types';
import { createNativeStorage } from './storage';
import { createNativeAuth } from './auth';
import { createNativeConnect, type NativeConnectOptions } from './connect';

export type NativeAdapterOptions = NativeConnectOptions;

/**
 * React Native / Expo adapter: `expo-secure-store` storage,
 * `expo-local-authentication` auth, and Leather/Xverse deep-link connect.
 *
 * BUNDLE SEPARATION: this file and its sub-adapters never statically import the
 * expo packages — each method does a dynamic `import()` instead. `detect.ts`
 * references both NativeAdapter and WebAdapter, so a static `import 'expo-*'`
 * here would be pulled into web bundles and break them (MEMORY.md → [ADAPTERS]
 * tree-shaking; verified by `pnpm size-check` not finding expo strings in web).
 */
export class NativeAdapter implements PlatformAdapter {
  readonly platform = 'native' as const;
  readonly storage: StorageAdapter;
  readonly auth: AuthAdapter;
  readonly connect: ConnectAdapter;

  constructor(options?: NativeAdapterOptions) {
    this.storage = createNativeStorage();
    this.auth = createNativeAuth();
    this.connect = createNativeConnect(options);
  }
}
