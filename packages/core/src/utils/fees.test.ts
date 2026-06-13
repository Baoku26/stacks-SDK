import { describe, it, expect, afterEach, vi } from 'vitest';
import { getFeeEstimate } from './fees';
import { SbtcErrorCode } from '../errors';

const MEMPOOL = 'https://mempool.space/testnet/api';

function stubFetch(impl: () => Promise<unknown> | unknown) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe('getFeeEstimate', () => {
  it('maps mempool recommended fees to {low, medium, high}', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({
        fastestFee: 30,
        halfHourFee: 20,
        hourFee: 10,
        economyFee: 5,
        minimumFee: 1,
      }),
    }));
    await expect(getFeeEstimate(MEMPOOL)).resolves.toEqual({ low: 10, medium: 20, high: 30 });
    expect(fetch).toHaveBeenCalledWith(
      'https://mempool.space/testnet/api/v1/fees/recommended',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('throws NETWORK_SECURITY_ERROR for a non-HTTPS endpoint (SR-8)', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({}) }));
    await expect(getFeeEstimate('http://mempool.space/api')).rejects.toMatchObject({
      code: SbtcErrorCode.NETWORK_SECURITY_ERROR,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws NETWORK_TIMEOUT on a non-2xx response', async () => {
    stubFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    await expect(getFeeEstimate(MEMPOOL)).rejects.toMatchObject({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      context: { status: 503 },
    });
  });

  it('throws NETWORK_TIMEOUT when fetch rejects', async () => {
    stubFetch(() => Promise.reject(new Error('network down')));
    await expect(getFeeEstimate(MEMPOOL)).rejects.toMatchObject({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
    });
  });
});
