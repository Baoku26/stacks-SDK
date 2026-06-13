import { describe, it, expect } from 'vitest';
import { isValidStxAddress, isValidBtcAddress } from './address';

describe('isValidStxAddress', () => {
  it('accepts valid mainnet/testnet Stacks addresses', () => {
    expect(isValidStxAddress('STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ')).toBe(true);
    expect(isValidStxAddress('SP000000000000000000002Q6VF78')).toBe(true);
  });

  it('rejects garbage', () => {
    expect(isValidStxAddress('nope')).toBe(false);
    expect(isValidStxAddress('')).toBe(false);
  });
});

describe('isValidBtcAddress', () => {
  const TB1 = 'tb1qrpvudpqvfhy2kw3a88rt2qplkdk9uu3jnggvy2'; // testnet p2wpkh

  it('accepts a testnet address when network is testnet (or unspecified)', () => {
    expect(isValidBtcAddress(TB1, 'testnet')).toBe(true);
    expect(isValidBtcAddress(TB1)).toBe(true);
  });

  it('rejects a testnet address under the mainnet network', () => {
    expect(isValidBtcAddress(TB1, 'mainnet')).toBe(false);
  });

  it('rejects malformed / empty input', () => {
    expect(isValidBtcAddress('not-an-address')).toBe(false);
    expect(isValidBtcAddress('')).toBe(false);
    expect(isValidBtcAddress('bc1qinvalidchecksum0000000000000000000000')).toBe(false);
  });
});
