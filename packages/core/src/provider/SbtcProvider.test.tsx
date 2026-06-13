import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SbtcProvider } from './SbtcProvider';
import { useSbtcContext } from './context';
import { NativeAdapter } from '../adapters/native';
import { WebAdapter } from '../adapters/web';
import { SsrAdapter } from '../adapters/ssr';
import { SbtcError, SbtcErrorCode } from '../errors';
import type { SbtcContextValue, SbtcProviderProps } from './types';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Renders the provider and returns the context value its children receive. */
function renderProvider(props: Omit<SbtcProviderProps, 'children'>): SbtcContextValue {
  let captured: SbtcContextValue | undefined;
  function Capture(): null {
    captured = useSbtcContext();
    return null;
  }
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      <SbtcProvider {...props}>
        <Capture />
      </SbtcProvider>,
    );
  });
  act(() => {
    renderer?.unmount();
  });
  if (captured === undefined) {
    throw new Error('context value was not captured');
  }
  return captured;
}

describe('SbtcProvider', () => {
  it('uses a custom adapter prop instead of auto-detecting', () => {
    const custom = new WebAdapter();
    const ctx = renderProvider({ network: 'testnet', adapter: custom });
    expect(ctx.adapter).toBe(custom);
    expect(ctx.network).toBe('testnet');
  });

  it('auto-detects NativeAdapter in a simulated React Native env', () => {
    vi.stubGlobal('navigator', { product: 'ReactNative' });
    // Buffer is present (Node), so the polyfill guard passes.
    const ctx = renderProvider({ network: 'mainnet' });
    expect(ctx.adapter).toBeInstanceOf(NativeAdapter);
  });

  it('auto-detects WebAdapter in a simulated browser env', () => {
    vi.stubGlobal('navigator', { product: 'Gecko' });
    vi.stubGlobal('window', {});
    const ctx = renderProvider({ network: 'mainnet' });
    expect(ctx.adapter).toBeInstanceOf(WebAdapter);
  });

  it('uses SsrAdapter in a simulated server env (no window, not React Native)', () => {
    vi.stubGlobal('navigator', { product: 'Node' });
    vi.stubGlobal('window', undefined);
    const ctx = renderProvider({ network: 'testnet' });
    expect(ctx.adapter).toBeInstanceOf(SsrAdapter);
  });

  it('resolves apiConfig from network defaults and merges overrides', () => {
    const ctx = renderProvider({
      network: 'mainnet',
      adapter: new WebAdapter(),
      apiConfig: { hiroApiUrl: 'https://custom.hiro.example' },
    });
    expect(ctx.apiConfig.hiroApiUrl).toBe('https://custom.hiro.example'); // override wins
    expect(ctx.apiConfig.emilyApiUrl).toBe('https://sbtc-emily.com'); // default kept
    expect(ctx.apiConfig.bitcoinApiUrl).toBe('https://mempool.space/api');
  });

  it('throws POLYFILL_NOT_INITIALIZED on native without global.Buffer', () => {
    vi.stubGlobal('Buffer', undefined);
    let error: unknown;
    try {
      act(() => {
        create(
          <SbtcProvider network="mainnet" adapter={new NativeAdapter()}>
            {null}
          </SbtcProvider>,
        );
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(SbtcError);
    expect((error as SbtcError).code).toBe(SbtcErrorCode.POLYFILL_NOT_INITIALIZED);
  });

  it('renders children and provides identical config on server and client (no hydration divergence)', () => {
    // The provider returns `<Context.Provider>{children}</Context.Provider>` with no
    // environment-conditional markup. `renderProvider` only returns if the child
    // actually rendered (it captures context), so reaching the asserts proves the
    // children rendered in BOTH environments; only the adapter differs by design.
    vi.stubGlobal('navigator', { product: 'Node' });
    vi.stubGlobal('window', undefined);
    const server = renderProvider({ network: 'mainnet' });
    expect(server.adapter).toBeInstanceOf(SsrAdapter);

    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', { product: 'Gecko' });
    vi.stubGlobal('window', {});
    const client = renderProvider({ network: 'mainnet' });
    expect(client.adapter).toBeInstanceOf(WebAdapter);

    expect(server.network).toBe(client.network);
    expect(server.apiConfig).toEqual(client.apiConfig);
  });
});
