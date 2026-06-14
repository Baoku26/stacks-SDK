import { describe, it, expect, vi } from 'vitest';

// `react-native-get-random-values` needs React Native's NativeModules and cannot
// load under Node/vitest — mock it as a no-op side-effect module so crypto.ts loads.
vi.mock('react-native-get-random-values', () => ({}));

// Importing the entry runs the polyfills (this is a non-browser env: no `window`).
import { applyBufferPolyfill, applyCryptoPolyfill, applyStreamsPolyfill } from './index';

interface PolyfilledGlobal {
  Buffer?: unknown;
  process?: { env?: unknown; nextTick?: unknown };
  crypto?: { subtle?: unknown; getRandomValues?: unknown };
}
const g = globalThis as unknown as PolyfilledGlobal;
const flags = globalThis as unknown as Record<string, unknown>;

describe('polyfills entry (simulated native env)', () => {
  it('defines Buffer, process, and crypto.getRandomValues after import', () => {
    expect(typeof g.Buffer).toBe('function');
    expect(g.process).toBeDefined();
    expect(g.crypto).toBeDefined();
    // The native crypto polyfill provides getRandomValues (via
    // react-native-get-random-values). `subtle` is intentionally NOT polyfilled
    // on native — here it is present only because the Node test runtime has it.
    expect(g.crypto?.getRandomValues).toBeDefined();
  });

  it('applyBufferPolyfill is idempotent and guarantees process.nextTick', () => {
    const before = g.Buffer;
    applyBufferPolyfill();
    applyBufferPolyfill();
    expect(g.Buffer).toBe(before);
    expect(typeof g.process?.nextTick).toBe('function');
  });

  it('applyCryptoPolyfill keeps existing subtle and never throws on re-apply', () => {
    const before = g.crypto?.subtle;
    expect(() => applyCryptoPolyfill()).not.toThrow();
    expect(g.crypto?.subtle).toBe(before);
  });

  it('applyStreamsPolyfill sets its marker idempotently', () => {
    applyStreamsPolyfill();
    applyStreamsPolyfill();
    expect(flags['__sbtcSdkStreamsPolyfilled']).toBe(true);
  });
});
