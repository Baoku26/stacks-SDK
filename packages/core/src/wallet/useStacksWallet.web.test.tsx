import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { SbtcProvider } from '../provider/SbtcProvider';
import { useStacksWallet, type UseStacksWalletResult } from './useStacksWallet';
import type { PlatformAdapter } from '../adapters/types';

// Exercises the platform-agnostic hook against a `platform: 'web'` adapter:
// (T039) it loads/derives like native once a client `window` exists, and
// (T040) it is a complete no-op during SSR (`window` undefined) — matching the
// client's initial unloaded render, so there is no hydration divergence.

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const WALLET_KEY = '@sbtc_sdk/wallet_v1';

/** In-memory web adapter; `storage.get` is a spy so SSR can assert it was never called. */
function makeWebAdapter(seed?: Record<string, string>): PlatformAdapter {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    platform: 'web',
    storage: {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      set: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      remove: vi.fn(async (k: string) => {
        store.delete(k);
      }),
    },
    auth: { isAvailable: async () => true, prompt: async () => true },
    connect: {
      signPsbt: vi.fn(),
      signStacksTx: vi.fn(),
      getAvailableWallets: vi.fn(async () => []),
    },
  };
}

/** Mounts the hook and waits for the async mount-load effect to settle. */
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

afterEach(() => vi.unstubAllGlobals());

describe('useStacksWallet on web', () => {
  it('(T039) loads and derives addresses on the client when window exists', async () => {
    vi.stubGlobal('window', {}); // client render
    const get = await renderWallet(makeWebAdapter({ [WALLET_KEY]: MNEMONIC }));
    expect(get().address).toBe('STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ');
    expect(get().btcAddress).toBe('tb1qrpvudpqvfhy2kw3a88rt2qplkdk9uu3jnggvy2');
    expect(get().error).toBeNull();
  });

  it('(T040) is a no-op during SSR: stays unloaded and never touches storage', async () => {
    // `window` is undefined in the node env (and afterEach unstubs any client stub).
    const adapter = makeWebAdapter({ [WALLET_KEY]: MNEMONIC });
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
    expect(latest?.isLoaded).toBe(false);
    expect(latest?.address).toBeNull();
    expect(latest?.error).toBeNull();
    expect(adapter.storage.get).not.toHaveBeenCalled();
  });
});
