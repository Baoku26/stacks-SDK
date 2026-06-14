import { describe, it, expect, beforeEach, vi } from 'vitest';
import { base64 } from '@scure/base';
import { NativeAdapter } from './index';
import { SbtcErrorCode } from '../../errors';

// --- Mocked expo native modules ---
// The adapter loads expo-* through `./expo` (loadSecureStore/…); the web/default
// variant has no runtime expo import and the `.native` variant statically imports
// the real packages (→ react-native, unparseable here). So we mock the `./expo`
// loader module directly, returning these fakes — platform-variant-agnostic.
const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn<(key: string) => Promise<string | null>>(),
  setItemAsync: vi.fn<(key: string, value: string, opts?: unknown) => Promise<void>>(),
  deleteItemAsync: vi.fn<(key: string) => Promise<void>>(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

const localAuth = vi.hoisted(() => ({
  hasHardwareAsync: vi.fn<() => Promise<boolean>>(),
  isEnrolledAsync: vi.fn<() => Promise<boolean>>(),
  authenticateAsync: vi.fn<(opts?: unknown) => Promise<{ success: boolean }>>(),
}));

const linking = vi.hoisted(() => {
  const state: { handler: ((event: { url: string }) => void) | null } = { handler: null };
  return {
    state,
    addEventListener: vi.fn((_type: string, handler: (event: { url: string }) => void) => {
      state.handler = handler;
      return { remove: vi.fn() };
    }),
    openURL: vi.fn<(url: string) => Promise<boolean>>(),
    canOpenURL: vi.fn<(url: string) => Promise<boolean>>(),
    parse: vi.fn<(url: string) => { queryParams: Record<string, string> | null }>(),
  };
});

vi.mock('./expo', () => ({
  loadSecureStore: () => Promise.resolve(secureStore),
  loadLocalAuthentication: () => Promise.resolve(localAuth),
  loadLinking: () => Promise.resolve(linking),
}));

beforeEach(() => {
  vi.clearAllMocks();
  linking.state.handler = null;
  linking.openURL.mockResolvedValue(true);
});

describe('NativeAdapter.storage (expo-secure-store)', () => {
  const { storage } = new NativeAdapter();

  // expo-secure-store only accepts keys matching this charset; the adapter must
  // map any logical key to one that satisfies it (regression: '@sbtc_sdk/wallet_v1').
  const SECURE_STORE_KEY = /^[\w.-]+$/;

  it('get returns the stored value (keyed by a SecureStore-safe token)', async () => {
    secureStore.getItemAsync.mockResolvedValue('the-value');
    await expect(storage.get('k')).resolves.toBe('the-value');
    const usedKey = secureStore.getItemAsync.mock.calls[0]?.[0];
    expect(usedKey).toMatch(SECURE_STORE_KEY);
  });

  it('encodes logical keys with invalid chars into a SecureStore-safe key', async () => {
    secureStore.getItemAsync.mockResolvedValue(null);
    await storage.get('@sbtc_sdk/wallet_v1'); // contains '@' and '/', rejected raw
    const usedKey = secureStore.getItemAsync.mock.calls[0]?.[0];
    expect(usedKey).toMatch(SECURE_STORE_KEY);
  });

  it('set/get/remove use the same derived key (round-trips)', async () => {
    secureStore.setItemAsync.mockResolvedValue();
    secureStore.deleteItemAsync.mockResolvedValue();
    await storage.set('@sbtc_sdk/wallet_v1', 'v');
    await storage.remove('@sbtc_sdk/wallet_v1');
    const setKey = secureStore.setItemAsync.mock.calls[0]?.[0];
    const removeKey = secureStore.deleteItemAsync.mock.calls[0]?.[0];
    expect(setKey).toBe(removeKey);
  });

  it('set writes with WHEN_UNLOCKED_THIS_DEVICE_ONLY', async () => {
    secureStore.setItemAsync.mockResolvedValue();
    await storage.set('k', 'v');
    const [usedKey, value, opts] = secureStore.setItemAsync.mock.calls[0] ?? [];
    expect(usedKey).toMatch(SECURE_STORE_KEY);
    expect(value).toBe('v');
    expect(opts).toEqual({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' });
  });

  it('wraps failures as STORAGE_ERROR', async () => {
    secureStore.getItemAsync.mockRejectedValue(new Error('keychain boom'));
    await expect(storage.get('k')).rejects.toMatchObject({
      code: SbtcErrorCode.STORAGE_ERROR,
      platform: 'native',
    });
  });
});

describe('NativeAdapter.auth (expo-local-authentication)', () => {
  const { auth } = new NativeAdapter();

  it('isAvailable is true only with hardware AND enrollment', async () => {
    localAuth.hasHardwareAsync.mockResolvedValue(true);
    localAuth.isEnrolledAsync.mockResolvedValue(true);
    await expect(auth.isAvailable()).resolves.toBe(true);

    localAuth.isEnrolledAsync.mockResolvedValue(false);
    await expect(auth.isAvailable()).resolves.toBe(false);
  });

  it('prompt returns the authentication result and forwards the reason', async () => {
    localAuth.authenticateAsync.mockResolvedValue({ success: true });
    await expect(auth.prompt('Unlock wallet')).resolves.toBe(true);
    expect(localAuth.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: 'Unlock wallet' }),
    );

    localAuth.authenticateAsync.mockResolvedValue({ success: false });
    await expect(auth.prompt('Unlock wallet')).resolves.toBe(false);
  });
});

describe('NativeAdapter.connect (deep-links)', () => {
  it('getAvailableWallets returns wallets whose scheme can be opened', async () => {
    linking.canOpenURL.mockImplementation(async (url) => url.startsWith('leather'));
    const wallets = await new NativeAdapter().connect.getAvailableWallets();
    expect(wallets.map((w) => w.name)).toEqual(['Leather']);
  });

  it('signPsbt opens the wallet and resolves the signed bytes from the callback', async () => {
    const adapter = new NativeAdapter({ callbackScheme: 'myapp' });
    const signed = new Uint8Array([9, 8, 7]);
    linking.parse.mockReturnValue({
      queryParams: { data: encodeURIComponent(base64.encode(signed)) },
    });

    const promise = adapter.connect.signPsbt(new Uint8Array([1, 2, 3]));
    // Wait for the dynamic import + addEventListener to register the handler.
    await vi.waitFor(() => expect(linking.state.handler).not.toBeNull());
    expect(linking.openURL).toHaveBeenCalledWith(expect.stringContaining('leather://psbt?data='));

    linking.state.handler?.({ url: 'myapp://psbt-signed?data=x' });
    await expect(promise).resolves.toEqual(signed);
  });

  it('rejects WALLET_CONNECT_UNAVAILABLE when the wallet cannot be opened', async () => {
    linking.openURL.mockRejectedValue(new Error('no app installed'));
    await expect(new NativeAdapter().connect.signPsbt(new Uint8Array([1]))).rejects.toMatchObject({
      code: SbtcErrorCode.WALLET_CONNECT_UNAVAILABLE,
    });
  });
});
