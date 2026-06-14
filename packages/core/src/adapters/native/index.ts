import type { AuthAdapter, ConnectAdapter, PlatformAdapter, StorageAdapter } from '../types';
import { createNativeStorage } from './storage';
import { createNativeAuth } from './auth';
import { createNativeConnect, type NativeConnectOptions } from './connect';

export type NativeAdapterOptions = NativeConnectOptions;

/**
 * React Native / Expo adapter: `expo-secure-store` storage,
 * `expo-local-authentication` auth, and Leather/Xverse deep-link connect.
 *
 * BUNDLE SEPARATION: `detect.ts` references both NativeAdapter and WebAdapter, so
 * this code is present in web bundles too. The expo packages are loaded through
 * `./expo` (`loadSecureStore`/`loadLocalAuthentication`/`loadLinking`), whose
 * web/default variant contains NO runtime `import('expo-*')` — only type-only
 * references — so web bundlers never traverse into `expo-*`/`react-native`. The
 * `.native` build variant (`expo.native.ts`) does the real static imports. This
 * removes the web consumer's bundler-alias step. See MEMORY.md → [ADAPTERS]
 * native module loading + web-graph isolation.
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
