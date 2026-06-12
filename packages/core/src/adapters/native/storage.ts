import { SbtcError, SbtcErrorCode } from '../../errors';
import type { StorageAdapter } from '../types';

/**
 * Native storage backed by `expo-secure-store` (hardware-encrypted Keychain /
 * Keystore). Values are written with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: accessible
 * only while the device is unlocked, never synced to iCloud/backups, deleted on
 * app uninstall (MEMORY.md → [ADAPTERS / NATIVE] access flags). All failures are
 * wrapped as `STORAGE_ERROR`.
 *
 * `expo-secure-store` is imported DYNAMICALLY so it never enters the static module
 * graph — that is what keeps it out of web bundles (see MEMORY.md → [ADAPTERS]
 * tree-shaking; `detect.ts` references this adapter).
 */
export function createNativeStorage(): StorageAdapter {
  return {
    async get(key) {
      try {
        const SecureStore = await import('expo-secure-store');
        return await SecureStore.getItemAsync(key);
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
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync(key, value, {
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
        const SecureStore = await import('expo-secure-store');
        await SecureStore.deleteItemAsync(key);
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
