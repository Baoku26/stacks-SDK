import { describe, it, expect, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { SbtcProvider } from '../provider/SbtcProvider';
import { useStacksWallet, type UseStacksWalletResult } from './useStacksWallet';
import { SbtcErrorCode } from '../errors';
import type { PlatformAdapter } from '../adapters/types';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/** In-memory native adapter; auth result and seeded storage are configurable. */
function makeMockAdapter(opts?: {
  authOk?: boolean;
  seed?: Record<string, string>;
}): PlatformAdapter {
  const store = new Map<string, string>(Object.entries(opts?.seed ?? {}));
  return {
    platform: 'native',
    storage: {
      get: async (k) => store.get(k) ?? null,
      set: async (k, v) => {
        store.set(k, v);
      },
      remove: async (k) => {
        store.delete(k);
      },
    },
    auth: {
      isAvailable: async () => true,
      prompt: async () => opts?.authOk ?? true,
    },
    connect: {
      signPsbt: vi.fn(),
      signStacksTx: vi.fn(),
      getAvailableWallets: vi.fn(async () => []),
    },
  };
}

/** Mounts useStacksWallet under SbtcProvider and returns a getter for the latest result. */
async function renderWallet(adapter: PlatformAdapter): Promise<() => UseStacksWalletResult> {
  let latest: UseStacksWalletResult | undefined;
  function Capture(): null {
    latest = useStacksWallet();
    return null;
  }
  await act(async () => {
    create(
      <SbtcProvider network="testnet" adapter={adapter}>
        <Capture />
      </SbtcProvider>,
    );
  });
  // Wait for the async mount-load effect to settle (storage.get → deriveAccount
  // runs PBKDF2 and takes tens of ms; `isLoaded` flips true once it completes).
  await act(async () => {
    for (let i = 0; i < 100 && latest?.isLoaded !== true; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });
  return () => {
    if (latest === undefined) throw new Error('hook result not captured');
    return latest;
  };
}

const WALLET_KEY = '@sbtc_sdk/wallet_v1';

describe('useStacksWallet', () => {
  it('loads to an empty state when no wallet is stored', async () => {
    const get = await renderWallet(makeMockAdapter());
    expect(get().isLoaded).toBe(true);
    expect(get().address).toBeNull();
    expect(get().btcAddress).toBeNull();
  });

  it('loads and derives addresses from a previously stored mnemonic', async () => {
    const get = await renderWallet(makeMockAdapter({ seed: { [WALLET_KEY]: MNEMONIC } }));
    expect(get().address).toBe('STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ');
    expect(get().btcAddress).toBe('tb1qrpvudpqvfhy2kw3a88rt2qplkdk9uu3jnggvy2');
  });

  it('generateWallet creates and exposes a new wallet', async () => {
    const get = await renderWallet(makeMockAdapter());
    await act(async () => {
      await get().generateWallet();
    });
    expect(get().address).toMatch(/^ST/);
    expect(get().btcAddress).toMatch(/^tb1q/);
    expect(get().publicKey).toMatch(/^0[23][0-9a-f]{64}$/);
    expect(get().error).toBeNull();
  });

  it('restoreWallet derives the right addresses for a valid mnemonic', async () => {
    const get = await renderWallet(makeMockAdapter());
    await act(async () => {
      await get().restoreWallet(MNEMONIC);
    });
    expect(get().address).toBe('STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ');
    expect(get().publicKey).toBe(
      '03d5d038bce81b3965314dba54f636f093c7dbdd6617cded013a53474fbccb100c',
    );
  });

  it('restoreWallet surfaces INVALID_MNEMONIC via the error field (does not throw)', async () => {
    const get = await renderWallet(makeMockAdapter());
    await act(async () => {
      await get().restoreWallet('not a valid phrase');
    });
    expect(get().error?.code).toBe(SbtcErrorCode.INVALID_MNEMONIC);
    expect(get().address).toBeNull();
  });

  it('lockWallet clears in-memory addresses', async () => {
    const get = await renderWallet(makeMockAdapter());
    await act(async () => {
      await get().restoreWallet(MNEMONIC);
    });
    act(() => {
      get().lockWallet();
    });
    expect(get().address).toBeNull();
    expect(get().publicKey).toBeNull();
    expect(get().isLocked).toBe(true);
  });

  it('exportMnemonic returns the mnemonic after a successful auth prompt', async () => {
    const get = await renderWallet(
      makeMockAdapter({ seed: { [WALLET_KEY]: MNEMONIC }, authOk: true }),
    );
    let exported = '';
    await act(async () => {
      exported = await get().exportMnemonic();
    });
    expect(exported).toBe(MNEMONIC);
  });

  it('exportMnemonic rejects AUTH_FAILED when auth is declined', async () => {
    const get = await renderWallet(
      makeMockAdapter({ seed: { [WALLET_KEY]: MNEMONIC }, authOk: false }),
    );
    await expect(get().exportMnemonic()).rejects.toMatchObject({ code: SbtcErrorCode.AUTH_FAILED });
  });

  it('clearWallet wipes storage and resets state after auth', async () => {
    const adapter = makeMockAdapter({ seed: { [WALLET_KEY]: MNEMONIC }, authOk: true });
    const get = await renderWallet(adapter);
    await act(async () => {
      await get().clearWallet();
    });
    expect(get().address).toBeNull();
    await expect(adapter.storage.get(WALLET_KEY)).resolves.toBeNull();
  });
});
