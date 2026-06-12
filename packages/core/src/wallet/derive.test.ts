import { describe, it, expect } from 'vitest';
import { deriveAccount } from './derive';
import { SbtcErrorCode } from '../errors';

// Canonical BIP39 test vector. Expected addresses computed from this fixed
// mnemonic; if @stacks/@scure derivation ever changes, this catches it.
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('deriveAccount', () => {
  it('derives the expected STX + BTC addresses on mainnet', async () => {
    const account = await deriveAccount(MNEMONIC, 'mainnet');
    expect(account.address).toBe('SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J');
    expect(account.btcAddress).toBe('bc1qrpvudpqvfhy2kw3a88rt2qplkdk9uu3jewnlle');
    expect(account.index).toBe(0);
  });

  it('derives the expected STX + BTC addresses on testnet', async () => {
    const account = await deriveAccount(MNEMONIC, 'testnet');
    expect(account.address).toBe('STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ');
    expect(account.btcAddress).toBe('tb1qrpvudpqvfhy2kw3a88rt2qplkdk9uu3jnggvy2');
  });

  it('throws INVALID_MNEMONIC for an invalid phrase', async () => {
    await expect(
      deriveAccount('clearly not a valid bip39 phrase', 'testnet'),
    ).rejects.toMatchObject({ code: SbtcErrorCode.INVALID_MNEMONIC });
  });
});
