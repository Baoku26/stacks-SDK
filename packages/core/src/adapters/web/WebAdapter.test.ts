import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hex } from '@scure/base';
import { makeUnsignedSTXTokenTransfer, serializeTransaction } from '@stacks/transactions';
import { WebAdapter } from './index';
import { SbtcErrorCode } from '../../errors';

// Runs in the default `node` vitest env (no `window`/`localStorage`). We stub the
// browser globals per-suite and use Node's real WebCrypto for genuine round-trips.

/** Minimal in-memory localStorage. */
function makeLocalStorage(): Storage & { _map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    _map: map,
  };
}

// ---- @stacks/connect is dynamically imported by connect.ts; mock it. ----
const connectMock = vi.hoisted(() => ({
  openPsbtRequestPopup: vi.fn(),
  openSignTransaction: vi.fn(),
}));
vi.mock('@stacks/connect', () => connectMock);

describe('WebAdapter.storage (localStorage + AES-GCM)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorage());
    vi.stubGlobal('navigator', { userAgent: 'vitest-ua' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips an encrypted value and never stores plaintext', async () => {
    const { storage } = new WebAdapter();
    await storage.set('@sbtc_sdk/wallet_v1', 'super secret mnemonic words');

    const raw = localStorage.getItem('@sbtc_sdk/wallet_v1');
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('super secret');
    expect(localStorage.getItem('@sbtc_sdk/wallet_v1.salt')).not.toBeNull();

    await expect(storage.get('@sbtc_sdk/wallet_v1')).resolves.toBe('super secret mnemonic words');
  });

  it('get returns null when the key is absent', async () => {
    const { storage } = new WebAdapter();
    await expect(storage.get('missing')).resolves.toBeNull();
  });

  it('remove deletes both the value and its salt', async () => {
    const { storage } = new WebAdapter();
    await storage.set('k', 'v');
    await storage.remove('k');
    await expect(storage.get('k')).resolves.toBeNull();
    expect(localStorage.getItem('k.salt')).toBeNull();
  });

  it('wraps a decryption failure as STORAGE_ERROR (web)', async () => {
    const { storage } = new WebAdapter();
    await storage.set('k', 'v');
    localStorage.setItem('k', 'AAAA.BBBB'); // valid base64, invalid ciphertext
    await expect(storage.get('k')).rejects.toMatchObject({
      code: SbtcErrorCode.STORAGE_ERROR,
      platform: 'web',
    });
  });
});

describe('WebAdapter.auth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('isAvailable is always true (passphrase fallback covers all contexts)', async () => {
    const { auth } = new WebAdapter();
    await expect(auth.isAvailable()).resolves.toBe(true);
  });

  it('falls back to onAuthRequired when WebAuthn is unavailable; non-empty ⇒ true', async () => {
    vi.stubGlobal('window', { isSecureContext: false }); // WebAuthn unavailable
    const onAuthRequired = vi.fn(async () => 'my-passphrase');
    const { auth } = new WebAdapter({ onAuthRequired });
    await expect(auth.prompt('Export recovery phrase')).resolves.toBe(true);
    expect(onAuthRequired).toHaveBeenCalledWith('Export recovery phrase');
  });

  it('passphrase fallback returns false when the user provides nothing', async () => {
    vi.stubGlobal('window', { isSecureContext: false });
    const { auth } = new WebAdapter({ onAuthRequired: async () => null });
    await expect(auth.prompt('reason')).resolves.toBe(false);
  });

  it('uses WebAuthn when available: registers on first prompt, asserts after', async () => {
    const credentials = {
      create: vi.fn(async () => ({ rawId: new Uint8Array([1, 2, 3, 4]).buffer })),
      get: vi.fn(async () => ({ type: 'public-key' })),
    };
    const ls = makeLocalStorage();
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('navigator', { credentials });
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
    });

    const { auth } = new WebAdapter();
    await expect(auth.prompt('Unlock')).resolves.toBe(true); // register
    expect(credentials.create).toHaveBeenCalledOnce();
    expect(credentials.get).not.toHaveBeenCalled();
    expect(ls.getItem('@sbtc_sdk/webauthn_cred_v1')).not.toBeNull();

    await expect(auth.prompt('Unlock')).resolves.toBe(true); // assert
    expect(credentials.get).toHaveBeenCalledOnce();
  });

  it('returns false when the WebAuthn ceremony throws/cancels', async () => {
    const credentials = {
      create: vi.fn(async () => {
        throw new Error('NotAllowedError');
      }),
      get: vi.fn(),
    };
    vi.stubGlobal('localStorage', makeLocalStorage());
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('navigator', { credentials });
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
    });

    const { auth } = new WebAdapter();
    await expect(auth.prompt('Unlock')).resolves.toBe(false);
  });
});

describe('WebAdapter.connect (@stacks/connect)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('signPsbt resolves the signed PSBT bytes from onFinish', async () => {
    const signed = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    connectMock.openPsbtRequestPopup.mockImplementation(
      (opts: { hex: string; onFinish: (d: { hex: string }) => void }) => {
        opts.onFinish({ hex: hex.encode(signed) });
      },
    );

    const { connect } = new WebAdapter();
    await expect(connect.signPsbt(new Uint8Array([1, 2, 3]))).resolves.toEqual(signed);
    expect(connectMock.openPsbtRequestPopup).toHaveBeenCalledWith(
      expect.objectContaining({ hex: hex.encode(new Uint8Array([1, 2, 3])) }),
    );
  });

  it('signPsbt rejects PSBT_SIGNING_FAILED when the user cancels', async () => {
    connectMock.openPsbtRequestPopup.mockImplementation((opts: { onCancel: () => void }) => {
      opts.onCancel();
    });
    const { connect } = new WebAdapter();
    await expect(connect.signPsbt(new Uint8Array([1]))).rejects.toMatchObject({
      code: SbtcErrorCode.PSBT_SIGNING_FAILED,
      platform: 'web',
    });
  });

  it('signStacksTx resolves the serialized signed transaction bytes', async () => {
    const tx = await makeUnsignedSTXTokenTransfer({
      recipient: 'ST000000000000000000002AMW42H',
      amount: 1n,
      publicKey: '03'.padEnd(66, '0'),
      fee: 1n,
      nonce: 0n,
      network: 'testnet',
    });
    connectMock.openSignTransaction.mockImplementation(
      (opts: { txHex: string; onFinish: (d: { stacksTransaction: unknown }) => void }) => {
        opts.onFinish({ stacksTransaction: tx });
      },
    );

    const { connect } = new WebAdapter();
    const result = await connect.signStacksTx(new Uint8Array([1, 2, 3]));
    expect(hex.encode(result)).toBe(serializeTransaction(tx));
  });

  it('getAvailableWallets advertises the supported set', async () => {
    const wallets = await new WebAdapter().connect.getAvailableWallets();
    expect(wallets.map((w) => w.name)).toEqual(['Leather', 'Xverse']);
  });
});
