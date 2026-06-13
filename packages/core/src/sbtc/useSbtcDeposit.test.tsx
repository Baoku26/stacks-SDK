import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SbtcProvider } from '../provider/SbtcProvider';
import { useSbtcDeposit, type UseSbtcDepositConfig } from './useSbtcDeposit';
import { DepositStatus } from './types';
import { SbtcErrorCode } from '../errors';
import type { PlatformAdapter } from '../adapters/types';

// --- Boundary mocks: the sbtc package, our emily glue, and @scure/btc-signer. ---
const client = vi.hoisted(() => ({
  fetchSignersPublicKey: vi.fn(async () => '02'.padEnd(66, 'a')),
  fetchUtxos: vi.fn(async () => [{ txid: 'u', vout: 0, value: 100_000 }]),
  fetchFeeRate: vi.fn(async () => 5),
  notifySbtc: vi.fn(async () => ({ status: 'pending' })),
  fetchDeposit: vi.fn(async () => ({ status: 'pending', statusMessage: '' })),
}));

vi.mock('./emily', () => ({
  createSbtcApiClient: () => client,
  broadcastRawTx: vi.fn(async () => 'btc-txid-123'),
  sbtcNetwork: () => ({}),
  mapEmilyStatus: (s: string) => s, // identity; tests feed 'confirmed' | 'failed' | 'pending'
}));

vi.mock('sbtc', () => ({
  sbtcDepositHelper: vi.fn(async () => ({
    depositScript: 'aa',
    reclaimScript: 'bb',
    address: 'tb1qdepositaddr',
    transaction: { toPSBT: () => new Uint8Array([1, 2, 3]) },
  })),
}));

vi.mock('@scure/btc-signer', () => ({
  Transaction: {
    fromPSBT: () => ({
      finalize: () => undefined,
      extract: () => new Uint8Array([0xab, 0xcd]),
    }),
  },
}));

const STX = 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT';
const BTC = 'tb1qrpvudpqvfhy2kw3a88rt2qplkdk9uu3jnggvy2';

function webAdapter(signPsbt?: PlatformAdapter['connect']['signPsbt']): PlatformAdapter {
  return {
    platform: 'web',
    storage: { get: vi.fn(async () => null), set: vi.fn(), remove: vi.fn() },
    auth: { isAvailable: async () => true, prompt: async () => true },
    connect: {
      signPsbt: signPsbt ?? vi.fn(async () => new Uint8Array([9, 9, 9])),
      signStacksTx: vi.fn(),
      getAvailableWallets: vi.fn(async () => []),
    },
  };
}

function baseConfig(over?: Partial<UseSbtcDepositConfig>): UseSbtcDepositConfig {
  return {
    stacksAddress: STX,
    bitcoinAddress: BTC,
    paymentPublicKey: '03'.padEnd(66, 'a'),
    pollIntervalMs: 1,
    ...over,
  };
}

async function renderDeposit(
  config: UseSbtcDepositConfig,
  adapter: PlatformAdapter,
): Promise<{ get: () => ReturnType<typeof useSbtcDeposit>; unmount: () => void }> {
  let latest: ReturnType<typeof useSbtcDeposit> | undefined;
  function Capture(): null {
    latest = useSbtcDeposit(config);
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
  get: () => ReturnType<typeof useSbtcDeposit>,
  status: DepositStatus,
): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 100 && get().status !== status; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  client.fetchDeposit.mockResolvedValue({ status: 'pending', statusMessage: '' });
});

describe('useSbtcDeposit', () => {
  it('rejects amounts below the 546 sat dust limit without building', async () => {
    const adapter = webAdapter();
    const { get, unmount } = await renderDeposit(baseConfig(), adapter);
    await act(async () => {
      await get().deposit(100);
    });
    expect(get().status).toBe(DepositStatus.FAILED);
    expect(get().error?.code).toBe(SbtcErrorCode.DEPOSIT_BELOW_DUST);
    expect(adapter.connect.signPsbt).not.toHaveBeenCalled();
    unmount();
  });

  it('runs build → sign → broadcast → notify → confirmed and fires onSuccess', async () => {
    client.fetchDeposit.mockResolvedValue({ status: 'confirmed', statusMessage: '' });
    const onSuccess = vi.fn();
    const adapter = webAdapter();
    const { get, unmount } = await renderDeposit(baseConfig({ onSuccess }), adapter);

    await act(async () => {
      await get().deposit(10_000);
    });
    expect(get().txid).toBe('btc-txid-123');
    expect(get().depositAddress).toBe('tb1qdepositaddr');
    expect(adapter.connect.signPsbt).toHaveBeenCalledOnce();

    await waitForStatus(get, DepositStatus.CONFIRMED);
    expect(get().status).toBe(DepositStatus.CONFIRMED);
    expect(onSuccess).toHaveBeenCalledWith('btc-txid-123');
    unmount();
  });

  it('uses a signPsbt override instead of the adapter', async () => {
    client.fetchDeposit.mockResolvedValue({ status: 'confirmed', statusMessage: '' });
    const override = vi.fn(async () => new Uint8Array([7, 7]));
    const adapter = webAdapter();
    const { get, unmount } = await renderDeposit(baseConfig({ signPsbt: override }), adapter);
    await act(async () => {
      await get().deposit(10_000);
    });
    expect(override).toHaveBeenCalledOnce();
    expect(adapter.connect.signPsbt).not.toHaveBeenCalled();
    unmount();
  });

  it('moves to FAILED and fires onError when Emily reports failure', async () => {
    client.fetchDeposit.mockResolvedValue({ status: 'failed', statusMessage: 'rejected by signers' });
    const onError = vi.fn();
    const { get, unmount } = await renderDeposit(baseConfig({ onError }), webAdapter());
    await act(async () => {
      await get().deposit(10_000);
    });
    await waitForStatus(get, DepositStatus.FAILED);
    expect(get().status).toBe(DepositStatus.FAILED);
    expect(get().error?.code).toBe(SbtcErrorCode.EMILY_API_ERROR);
    expect(onError).toHaveBeenCalledOnce();
    unmount();
  });

  it('reset() returns the hook to idle', async () => {
    client.fetchDeposit.mockResolvedValue({ status: 'confirmed', statusMessage: '' });
    const { get, unmount } = await renderDeposit(baseConfig(), webAdapter());
    await act(async () => {
      await get().deposit(10_000);
    });
    await waitForStatus(get, DepositStatus.CONFIRMED);
    act(() => get().reset());
    expect(get().status).toBe(DepositStatus.IDLE);
    expect(get().txid).toBeNull();
    expect(get().error).toBeNull();
    unmount();
  });
});
