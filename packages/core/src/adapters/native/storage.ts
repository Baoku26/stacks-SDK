import { Buffer } from 'buffer';
import { hex } from '@scure/base';
import { SbtcError, SbtcErrorCode } from '../../errors';
import type { StorageAdapter } from '../types';
import { loadSecureStore } from './expo';

/**
 * Maps an arbitrary logical key to an `expo-secure-store`-safe key.
 *
 * SecureStore only accepts keys matching `/^[\w.-]+$/` (alphanumerics, `.`, `-`,
 * `_`); the SDK's logical keys (e.g. `@sbtc_sdk/wallet_v1`) contain `@`/`/` and are
 * rejected. The adapter — not the platform-agnostic hooks — owns this constraint,
 * so we hex-encode the UTF-8 key into a stable, collision-free token (hex is all
 * `[0-9a-f]`, always valid). Opaque is fine: these keys are internal to the
 * Keychain. See MEMORY.md → [ADAPTERS / NATIVE] SecureStore key charset.
 */
const toSecureStoreKey = (key: string): string => hex.encode(Buffer.from(key, 'utf8'));

/**
 * Native storage backed by `expo-secure-store` (hardware-encrypted Keychain /
 * Keystore). Values are written with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: accessible
 * only while the device is unlocked, never synced to iCloud/backups, deleted on
 * app uninstall (MEMORY.md → [ADAPTERS / NATIVE] access flags). All failures are
 * wrapped as `STORAGE_ERROR`.
 *
 * `expo-secure-store` is loaded via `loadSecureStore()` (`./expo`): dynamic
 * `import()` on web (kept out of web bundles), STATIC import on native via the
 * `expo.native.ts` build variant (Metro can't resolve a runtime dynamic import
 * of a node module). See MEMORY.md → [ADAPTERS] native module loading.
 */
export function createNativeStorage(): StorageAdapter {
  return {
    async get(key) {
      try {
        const SecureStore = await loadSecureStore();
        return await SecureStore.getItemAsync(toSecureStoreKey(key));
      } catch (originalError) {
        throw new SbtcError({
          code: SbtcErrorCode.STORAGE_ERROR,
          originalError,
          platform: 'native',
          context: { key },
        });
      }
    },

    async set(key, value) {
      try {
        const SecureStore = await loadSecureStore();
        await SecureStore.setItemAsync(toSecureStoreKey(key), value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      } catch (originalError) {
        throw new SbtcError({
          code: SbtcErrorCode.STORAGE_ERROR,
          originalError,
          platform: 'native',
          context: { key },
        });
      }
    },

    async remove(key) {
      try {
        const SecureStore = await loadSecureStore();
        await SecureStore.deleteItemAsync(toSecureStoreKey(key));
      } catch (originalError) {
        throw new SbtcError({
          code: SbtcErrorCode.STORAGE_ERROR,
          originalError,
          platform: 'native',
          context: { key },
        });
      }
    },
  };
}
