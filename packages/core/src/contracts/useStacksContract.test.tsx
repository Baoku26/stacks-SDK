import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SbtcProvider } from '../provider/SbtcProvider';
import { useStacksContract, type UseStacksContractConfig } from './useStacksContract';
import { SbtcErrorCode, SbtcError } from '../errors';
import type { PlatformAdapter } from '../adapters/types';

// Mock the Stacks tx builder/codec at the boundary; `@scure/base` (hex) runs for real.
vi.mock('@stacks/transactions', () => ({
  serializeCV: (v: unknown) => JSON.stringify(v),
  cvToValue: (v: unknown) => v, // passthrough so tests assert on the raw return
  makeUnsignedContractCall: vi.fn(async () => ({ __tx: true })),
  serializeTransaction: vi.fn(() => 'aabb'),
}));

const node = vi.hoisted(() => ({
  callReadOnly: vi.fn(async (): Promise<unknown> => ({ value: 42 })),
  broadcastStacksTx: vi.fn(async () => 'stx-txid-1'),
  fetchStacksNonce: vi.fn(async () => 3),
}));
vi.mock('./stacksNode', () => node);

const CONTRACT = 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.my-contract';
const SENDER = {
  address: 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT',
  publicKey: '03'.padEnd(66, 'a'),
};

function webAdapter(signStacksTx?: PlatformAdapter['connect']['signStacksTx']): PlatformAdapter {
  return {
    platform: 'web',
    storage: { get: vi.fn(async () => null), set: vi.fn(), remove: vi.fn() },
    auth: { isAvailable: async () => true, prompt: async () => true },
    connect: {
      signPsbt: vi.fn(),
      signStacksTx: signStacksTx ?? vi.fn(async () => new Uint8Array([1, 2])),
      getAvailableWallets: vi.fn(async () => []),
    },
  };
}

async function renderContract(
  config: UseStacksContractConfig,
  adapter: PlatformAdapter,
): Promise<{ get: () => ReturnType<typeof useStacksContract>; unmount: () => void }> {
  let latest: ReturnType<typeof useStacksContract> | undefined;
  function Capture(): null {
    latest = useStacksContract(config);
    return null;
  }
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <SbtcProvider network="testnet" adapter={adapter}>
        <Capture />
      </SbtcProvider>,
    );
  });
  return {
    get: () => {
      if (latest === undefined) throw new Error('hook not captured');
      return latest;
    },
    unmount: () => act(() => renderer.unmount()),
  };
}

async function settle(get: () => ReturnType<typeof useStacksContract>): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 100 && get().isLoading; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  node.callReadOnly.mockResolvedValue({ value: 42 });
  node.broadcastStacksTx.mockResolvedValue('stx-txid-1');
  node.fetchStacksNonce.mockResolvedValue(3);
});

describe('useStacksContract — read-only', () => {
  it('evaluates the read-only query on mount and decodes the result', async () => {
    const { get, unmount } = await renderContract(
      { contract: CONTRACT, readOnly: { fn: 'get-count' } },
      webAdapter(),
    );
    await settle(get);
    expect(get().data).toEqual({ value: 42 });
    expect(get().error).toBeNull();
    // sender defaults to the contract address; no args
    expect(node.callReadOnly).toHaveBeenCalledWith(
      expect.anything(),
      CONTRACT,
      'get-count',
      [],
      'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT',
      'web',
    );
    unmount();
  });

  it('is idle (no fetch) when no readOnly query is configured', async () => {
    const { get, unmount } = await renderContract({ contract: CONTRACT }, webAdapter());
    expect(get().isLoading).toBe(false);
    expect(get().data).toBeNull();
    expect(node.callReadOnly).not.toHaveBeenCalled();
    unmount();
  });

  it('surfaces a read-only failure via the error field', async () => {
    node.callReadOnly.mockRejectedValue(
      new SbtcError({ code: SbtcErrorCode.NETWORK_TIMEOUT, platform: 'web' }),
    );
    const { get, unmount } = await renderContract(
      { contract: CONTRACT, readOnly: { fn: 'get-count' } },
      webAdapter(),
    );
    await settle(get);
    expect(get().data).toBeNull();
    expect(get().error?.code).toBe(SbtcErrorCode.NETWORK_TIMEOUT);
    unmount();
  });

  it('refetch() re-runs the read-only query', async () => {
    const { get, unmount } = await renderContract(
      { contract: CONTRACT, readOnly: { fn: 'get-count' } },
      webAdapter(),
    );
    await settle(get);
    expect(node.callReadOnly).toHaveBeenCalledTimes(1);
    await act(async () => {
      get().refetch();
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(node.callReadOnly).toHaveBeenCalledTimes(2);
    unmount();
  });
});

describe('useStacksContract — call()', () => {
  it('builds → signs → broadcasts and resolves to the Stacks txid', async () => {
    const adapter = webAdapter();
    const { get, unmount } = await renderContract({ contract: CONTRACT, sender: SENDER }, adapter);
    let txid: string | null = null;
    await act(async () => {
      txid = await get().call('do-thing');
    });
    expect(txid).toBe('stx-txid-1');
    expect(node.fetchStacksNonce).toHaveBeenCalledOnce();
    expect(adapter.connect.signStacksTx).toHaveBeenCalledOnce();
    expect(node.broadcastStacksTx).toHaveBeenCalledOnce();
    expect(get().error).toBeNull();
    unmount();
  });

  it('uses a per-call signTx override instead of the adapter', async () => {
    const override = vi.fn(async () => new Uint8Array([9]));
    const adapter = webAdapter();
    const { get, unmount } = await renderContract({ contract: CONTRACT, sender: SENDER }, adapter);
    await act(async () => {
      await get().call('do-thing', [], { signTx: override });
    });
    expect(override).toHaveBeenCalledOnce();
    expect(adapter.connect.signStacksTx).not.toHaveBeenCalled();
    unmount();
  });

  it('returns null and sets WALLET_NOT_FOUND when sender is missing', async () => {
    const adapter = webAdapter();
    const { get, unmount } = await renderContract({ contract: CONTRACT }, adapter);
    let txid: string | null = 'unset';
    await act(async () => {
      txid = await get().call('do-thing');
    });
    expect(txid).toBeNull();
    expect(get().error?.code).toBe(SbtcErrorCode.WALLET_NOT_FOUND);
    expect(adapter.connect.signStacksTx).not.toHaveBeenCalled();
    unmount();
  });
});
