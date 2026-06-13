import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SbtcProvider } from '../provider/SbtcProvider';
import { useStxBalance } from './useStxBalance';
import { useNonce } from './useNonce';
import { useSbtcBalance } from '../sbtc/useSbtcBalance';
import { TESTNET } from '../utils/network';
import { SbtcErrorCode } from '../errors';
import type { PlatformAdapter } from '../adapters/types';

const ADDRESS = 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT';

function webAdapter(): PlatformAdapter {
  return {
    platform: 'web',
    storage: { get: vi.fn(async () => null), set: vi.fn(), remove: vi.fn() },
    auth: { isAvailable: async () => true, prompt: async () => true },
    connect: { signPsbt: vi.fn(), signStacksTx: vi.fn(), getAvailableWallets: vi.fn(async () => []) },
  };
}

/** Respond per-URL; an unmatched URL fails the test loudly. */
function stubFetch(routes: Record<string, unknown>, opts?: { ok?: boolean; status?: number }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((frag) => url.includes(frag));
      if (key === undefined) throw new Error(`unexpected fetch: ${url}`);
      return { ok: opts?.ok ?? true, status: opts?.status ?? 200, json: async () => routes[key] };
    }),
  );
}

async function renderHook<T>(useHook: () => T): Promise<{ get: () => T; unmount: () => void }> {
  let latest: T | undefined;
  function Capture(): null {
    latest = useHook();
    return null;
  }
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <SbtcProvider network="testnet" adapter={webAdapter()}>
        <Capture />
      </SbtcProvider>,
    );
  });
  const get = (): T => {
    if (latest === undefined) throw new Error('hook result not captured');
    return latest;
  };
  // Let the mount-fetch effect settle (data arrives or the call errors).
  await act(async () => {
    for (let i = 0; i < 50 && (get() as { isLoading: boolean }).isLoading; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
  });
  return { get, unmount: () => act(() => renderer.unmount()) };
}

afterEach(() => vi.unstubAllGlobals());

describe('useStxBalance', () => {
  it('returns microSTX and a formatted STX string', async () => {
    stubFetch({ '/v2/accounts/': { balance: '0x1e240', locked: '0x0', nonce: 3 } }); // 0x1e240 = 123456
    const { get, unmount } = await renderHook(() => useStxBalance(ADDRESS, { pollIntervalMs: 0 }));
    expect(get().microStx).toBe(123_456n);
    expect(get().stx).toBe('0.123456 STX');
    expect(get().error).toBeNull();
    unmount();
  });

  it('is idle (not loading, no fetch) when address is missing', async () => {
    stubFetch({ '/v2/accounts/': {} });
    const { get, unmount } = await renderHook(() => useStxBalance(null));
    expect(get().isLoading).toBe(false);
    expect(get().microStx).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    unmount();
  });
});

describe('useNonce', () => {
  it('returns the pending nonce fresh from /v2/accounts', async () => {
    stubFetch({ '/v2/accounts/': { balance: '0x0', locked: '0x0', nonce: 42 } });
    const { get, unmount } = await renderHook(() => useNonce(ADDRESS));
    expect(get().nonce).toBe(42);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/v2/accounts/${ADDRESS}`),
      expect.anything(),
    );
    unmount();
  });

  it('refresh() re-fetches', async () => {
    stubFetch({ '/v2/accounts/': { balance: '0x0', locked: '0x0', nonce: 1 } });
    const { get, unmount } = await renderHook(() => useNonce(ADDRESS));
    expect(get().nonce).toBe(1);
    await act(async () => {
      get().refresh();
      await new Promise((r) => setTimeout(r, 5));
    });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
    unmount();
  });
});

describe('useSbtcBalance', () => {
  it('reads the sBTC token balance and formats BTC', async () => {
    stubFetch({
      '/extended/v1/address/': {
        fungible_tokens: { [TESTNET.sbtcTokenAssetId]: { balance: '250000' } },
      },
    });
    const { get, unmount } = await renderHook(() => useSbtcBalance(ADDRESS, { pollIntervalMs: 0 }));
    expect(get().sats).toBe(250_000n);
    expect(get().btc).toBe('0.0025 BTC');
    unmount();
  });

  it('returns zero when the account holds no sBTC token', async () => {
    stubFetch({ '/extended/v1/address/': { fungible_tokens: {} } });
    const { get, unmount } = await renderHook(() => useSbtcBalance(ADDRESS, { pollIntervalMs: 0 }));
    expect(get().sats).toBe(0n);
    expect(get().btc).toBe('0 BTC');
    unmount();
  });

  it('surfaces a non-2xx response as NETWORK_TIMEOUT via the error field', async () => {
    stubFetch({ '/extended/v1/address/': {} }, { ok: false, status: 500 });
    const { get, unmount } = await renderHook(() => useSbtcBalance(ADDRESS, { pollIntervalMs: 0 }));
    expect(get().sats).toBeNull();
    expect(get().error?.code).toBe(SbtcErrorCode.NETWORK_TIMEOUT);
    unmount();
  });
});
