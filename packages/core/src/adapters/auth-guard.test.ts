import { describe, it, expect, vi } from 'vitest';
import { withAuthGuard } from './auth-guard';
import { SbtcError, SbtcErrorCode } from '../errors';
import type { PlatformAdapter } from './types';

/** Minimal adapter whose auth behaviour is configurable per test. */
function makeAdapter(opts: { isAvailable: boolean; prompt: boolean }): {
  adapter: PlatformAdapter;
  isAvailable: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
} {
  const isAvailable = vi.fn(async () => opts.isAvailable);
  const prompt = vi.fn(async () => opts.prompt);
  const adapter = {
    platform: 'native',
    storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
    auth: { isAvailable, prompt },
    connect: { signPsbt: vi.fn(), signStacksTx: vi.fn(), getAvailableWallets: vi.fn() },
  } as unknown as PlatformAdapter;
  return { adapter, isAvailable, prompt };
}

describe('withAuthGuard', () => {
  it('runs fn and returns its value when auth succeeds', async () => {
    const { adapter, prompt } = makeAdapter({ isAvailable: true, prompt: true });
    const fn = vi.fn(async () => 'secret');

    const result = await withAuthGuard(adapter, fn, 'Export recovery phrase');

    expect(result).toBe('secret');
    expect(fn).toHaveBeenCalledOnce();
    expect(prompt).toHaveBeenCalledWith('Export recovery phrase');
  });

  it('throws AUTH_FAILED and does NOT run fn when the user fails/cancels', async () => {
    const { adapter } = makeAdapter({ isAvailable: true, prompt: false });
    const fn = vi.fn(async () => 'secret');

    await expect(withAuthGuard(adapter, fn)).rejects.toMatchObject({
      code: SbtcErrorCode.AUTH_FAILED,
      platform: 'native',
    });
    await expect(withAuthGuard(adapter, fn)).rejects.toBeInstanceOf(SbtcError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('throws AUTH_UNAVAILABLE and never prompts or runs fn when auth is unavailable', async () => {
    const { adapter, prompt } = makeAdapter({ isAvailable: false, prompt: true });
    const fn = vi.fn(async () => 'secret');

    await expect(withAuthGuard(adapter, fn)).rejects.toMatchObject({
      code: SbtcErrorCode.AUTH_UNAVAILABLE,
    });
    expect(prompt).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('defaults the reason when none is provided', async () => {
    const { adapter, prompt } = makeAdapter({ isAvailable: true, prompt: true });
    await withAuthGuard(adapter, async () => undefined);
    expect(prompt).toHaveBeenCalledWith('Authenticate to continue');
  });
});
