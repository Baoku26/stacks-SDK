import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { privateKeyToPublic } from '@stacks/transactions';
import { p2wpkh, NETWORK, TEST_NETWORK } from '@scure/btc-signer';
import { hex } from '@scure/base';
import { SbtcError, SbtcErrorCode } from '../errors';
import type { NetworkMode } from '../provider/types';
import type { Account } from './types';

// @stacks/wallet-sdk's generateWallet requires a password to encrypt its (unused)
// wallet-config blob. It is NOT the user's secret and is never persisted — only
// the mnemonic is stored, via the secure storage adapter.
const WALLET_CONFIG_PASSWORD = 'sbtc-sdk-internal';

/**
 * Derives the account-0 Stacks address and matching Bitcoin p2wpkh address from a
 * BIP39 mnemonic. Pure (no storage/auth); platform-agnostic.
 *
 * BTC derivation uses `@scure/btc-signer` (pure-JS, React-Native-safe) rather than
 * `bitcoinjs-lib` + `tiny-secp256k1` — the latter's native/WASM binding is a known
 * RN pain point. `@stacks/transactions.privateKeyToPublic` already returns a
 * compressed 33-byte public key (hex).
 *
 * @throws SbtcError(INVALID_MNEMONIC) if the phrase is not a valid BIP39 mnemonic.
 */
export async function deriveAccount(mnemonic: string, network: NetworkMode): Promise<Account> {
  let wallet;
  try {
    wallet = await generateWallet({ secretKey: mnemonic, password: WALLET_CONFIG_PASSWORD });
  } catch (originalError) {
    throw new SbtcError({ code: SbtcErrorCode.INVALID_MNEMONIC, originalError });
  }

  const account = wallet.accounts[0];
  if (account === undefined) {
    throw new SbtcError({ code: SbtcErrorCode.INVALID_MNEMONIC });
  }

  const address = getStxAddress({ account, network });
  // privateKeyToPublic returns a compressed 33-byte key; typed as string | bytes.
  const pub = privateKeyToPublic(account.stxPrivateKey);
  const publicKey = typeof pub === 'string' ? hex.decode(pub) : pub;
  const btcAddress = p2wpkh(publicKey, network === 'mainnet' ? NETWORK : TEST_NETWORK).address;

  return { address, btcAddress, index: 0 };
}
