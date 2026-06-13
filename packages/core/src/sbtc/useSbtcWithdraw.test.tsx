import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SbtcProvider } from '../provider/SbtcProvider';
import { useSbtcWithdraw, type UseSbtcWithdrawConfig } from './useSbtcWithdraw';
import { WithdrawalStatus } from './types';
import { SbtcErrorCode } from '../errors';
import type { PlatformAdapter } from '../adapters/types';

// `@scure/btc-signer` is NOT mocked: real address validation + PoX-tuple decoding run.
// Mock the Stacks tx builder and our Emily/Stacks glue at the boundary.
vi.mock('@stacks/transactions', () => ({
  makeUnsignedContractCall: vi.fn(async () => ({ __tx: true })),
  serializeTransaction: vi.fn(() => 'aabb'),
  uintCV: (v: unknown) => ({ uint: v }),
  bufferCV: (v: unknown) => ({ buff: v }),
  tupleCV: (v: unknown) => ({ tuple: v }),
  validateStacksAddress: () => true,
}));

const emily = vi.hoisted(() => ({
  broadcastStacksTx: vi.fn(async () => 'stx-txid-1'),
  fetchStacksNonce: vi.fn(async () => 0),
  fetchWithdrawalStatus: vi.fn(
    async (): Promise<{ status: string; bitcoinTxid?: string }> => ({ status: 'pending' }),
  ),
}));
vi.mock('./emily', () => ({
  ...emily,
  mapEmilyStatus: (s: string) => s, // identity; tests feed 'confirmed' | 'failed' | 'pending'
}));

const STX = 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT';
const BTC = 'tb1qrpvudpqvfhy2kw3a88rt2qplkdk9uu3jnggvy2'; // valid testnet p2wpkh

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

function baseConfig(over?: Partial<UseSbtcWithdrawConfig>): UseSbtcWithdrawConfig {
  return {
    stacksAddress: STX,
    stacksPublicKey: '03'.padEnd(66, 'a'),
    pollIntervalMs: 1,
    ...over,
  };
}

async function renderWithdraw(
  config: UseSbtcWithdrawConfig,
  adapter: PlatformAdapter,
): Promise<{ get: () => ReturnType<typeof useSbtcWithdraw>; unmount: () => void }> {
  let latest: ReturnType<typeof useSbtcWithdraw> | undefined;
  function Capture(): null {
    latest = useSbtcWithdraw(config);
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

async function waitForStatus(
  get: () => ReturnType<typeof useSbtcWithdraw>,
  status: WithdrawalStatus,
): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 100 && get().status !== status; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  emily.broadcastStacksTx.mockResolvedValue('stx-txid-1');
  emily.fetchStacksNonce.mockResolvedValue(0);
  emily.fetchWithdrawalStatus.mockResolvedValue({ status: 'pending', bitcoinTxid: undefined });
});

describe('useSbtcWithdraw', () => {
  it('exposes a static 60-minute confirmation estimate', async () => {
    const { get, unmount } = await renderWithdraw(baseConfig(), webAdapter());
    expect(get().estimatedConfirmationMinutes).toBe(60);
    unmount();
  });

  it('rejects an invalid BTC address without building', async () => {
    const adapter = webAdapter();
    const { get, unmount } = await renderWithdraw(baseConfig(), adapter);
    await act(async () => {
      await get().withdraw(50_000, 'not-a-btc-address');
    });
    expect(get().status).toBe(WithdrawalStatus.FAILED);
    expect(get().error?.code).toBe(SbtcErrorCode.INVALID_BTC_ADDRESS);
    expect(adapter.connect.signStacksTx).not.toHaveBeenCalled();
    unmount();
  });

  it('runs build → sign → broadcast → confirmed and fires onSuccess with the BTC txid', async () => {
    emily.fetchWithdrawalStatus.mockResolvedValue({ status: 'confirmed', bitcoinTxid: 'btc-out-1' });
    const onSuccess = vi.fn();
    const adapter = webAdapter();
    const { get, unmount } = await renderWithdraw(baseConfig({ onSuccess }), adapter);

    await act(async () => {
      await get().withdraw(50_000, BTC);
    });
    expect(get().stacksTxid).toBe('stx-txid-1');
    expect(adapter.connect.signStacksTx).toHaveBeenCalledOnce();

    await waitForStatus(get, WithdrawalStatus.CONFIRMED);
    expect(get().btcTxid).toBe('btc-out-1');
    expect(onSuccess).toHaveBeenCalledWith('btc-out-1');
    unmount();
  });

  it('uses a signTx override instead of the adapter', async () => {
    emily.fetchWithdrawalStatus.mockResolvedValue({ status: 'confirmed', bitcoinTxid: 'btc-out-2' });
    const override = vi.fn(async () => new Uint8Array([9]));
    const adapter = webAdapter();
    const { get, unmount } = await renderWithdraw(baseConfig({ signTx: override }), adapter);
    await act(async () => {
      await get().withdraw(50_000, BTC);
    });
    expect(override).toHaveBeenCalledOnce();
    expect(adapter.connect.signStacksTx).not.toHaveBeenCalled();
    unmount();
  });

  it('moves to FAILED and fires onError when Emily reports failure', async () => {
    emily.fetchWithdrawalStatus.mockResolvedValue({ status: 'failed', bitcoinTxid: undefined });
    const onError = vi.fn();
    const { get, unmount } = await renderWithdraw(baseConfig({ onError }), webAdapter());
    await act(async () => {
      await get().withdraw(50_000, BTC);
    });
    await waitForStatus(get, WithdrawalStatus.FAILED);
    expect(get().error?.code).toBe(SbtcErrorCode.EMILY_API_ERROR);
    expect(onError).toHaveBeenCalledOnce();
    unmount();
  });

  it('reset() returns the hook to idle', async () => {
    emily.fetchWithdrawalStatus.mockResolvedValue({ status: 'confirmed', bitcoinTxid: 'btc-out-3' });
    const { get, unmount } = await renderWithdraw(baseConfig(), webAdapter());
    await act(async () => {
      await get().withdraw(50_000, BTC);
    });
    await waitForStatus(get, WithdrawalStatus.CONFIRMED);
    act(() => get().reset());
    expect(get().status).toBe(WithdrawalStatus.IDLE);
    expect(get().stacksTxid).toBeNull();
    expect(get().btcTxid).toBeNull();
    unmount();
  });
});
