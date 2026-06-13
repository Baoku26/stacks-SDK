import { describe, it, expect } from 'vitest';
import { satsToBtc, btcToSats, formatSats, formatBtc } from './format';

describe('satsToBtc', () => {
  it('converts whole and fractional amounts, trimming trailing zeros', () => {
    expect(satsToBtc(0n)).toBe('0');
    expect(satsToBtc(100_000_000n)).toBe('1');
    expect(satsToBtc(123_450_000n)).toBe('1.2345');
    expect(satsToBtc(1n)).toBe('0.00000001');
    expect(satsToBtc(546n)).toBe('0.00000546');
    expect(satsToBtc(250_000_000n)).toBe('2.5');
  });

  it('accepts a number and handles negatives', () => {
    expect(satsToBtc(50_000_000)).toBe('0.5');
    expect(satsToBtc(-100_000_000n)).toBe('-1');
  });
});

describe('btcToSats', () => {
  it('parses decimal strings and numbers to satoshis', () => {
    expect(btcToSats('1')).toBe(100_000_000n);
    expect(btcToSats('1.2345')).toBe(123_450_000n);
    expect(btcToSats('0.00000001')).toBe(1n);
    expect(btcToSats(0.5)).toBe(50_000_000n);
    expect(btcToSats('.5')).toBe(50_000_000n);
  });

  it('truncates beyond 8 decimals (never invents value)', () => {
    expect(btcToSats('0.000000019')).toBe(1n);
  });

  it('round-trips with satsToBtc', () => {
    for (const sats of [0n, 1n, 546n, 123_450_000n, 2_100_000_000_000_000n]) {
      expect(btcToSats(satsToBtc(sats))).toBe(sats);
    }
  });

  it('throws on non-numeric input', () => {
    expect(() => btcToSats('abc')).toThrow();
    expect(() => btcToSats('')).toThrow();
    expect(() => btcToSats('.')).toThrow();
    expect(() => btcToSats('1.2.3')).toThrow();
  });
});

describe('formatSats / formatBtc', () => {
  it('appends the BTC unit', () => {
    expect(formatSats(123_450_000n)).toBe('1.2345 BTC');
    expect(formatSats(0n)).toBe('0 BTC');
    expect(formatBtc('0.001')).toBe('0.001 BTC');
    expect(formatBtc(2.5)).toBe('2.5 BTC');
  });
});
