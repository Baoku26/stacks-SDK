import { getStxAddress, deriveAccount as deriveStacksAccount, DerivationType } from '@stacks/wallet-sdk';
import { privateKeyToPublic } from '@stacks/transactions';
import { p2wpkh, NETWORK, TEST_NETWORK } from '@scure/btc-signer';
import { hex } from '@scure/base';
import { mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { SbtcError, SbtcErrorCode } from '../errors';
import type { NetworkMode } from '../provider/types';
import type { Account } from './types';

/**
 * Derives the account-0 Stacks address and matching Bitcoin p2wpkh address from a
 * BIP39 mnemonic. Pure (no storage/auth); platform-agnostic.
 *
 * Derives directly with `@scure/bip39` + `@scure/bip32` (the same packages, at the
 * same versions, that `@stacks/wallet-sdk` uses internally) rather than calling
 * `generateWallet()`. `generateWallet` additionally runs `encryptMnemonic` (to
 * produce an `encryptedSecretKey` we never use — the raw mnemonic is persisted via
 * the secure storage adapter) and `deriveSalt` (we discard `account.salt`). Both
 * route through `@stacks/encryption`'s `getCryptoLib()`, which requires WebCrypto
 * `crypto.subtle` OR Node's `crypto` — neither exists on React Native (Hermes), so
 * it throws `NO_CRYPTO_LIB`. The key derivation itself (`mnemonicToSeed` → `HDKey`
 * → `deriveAccount`) is pure JS (@noble) and needs no such lib. The derived
 * `stxPrivateKey`/addresses are byte-identical to the `generateWallet` path (salt
 * does not affect them). See MEMORY.md → [WALLET] native derivation / crypto lib.
 *
 * BTC derivation uses `@scure/btc-signer` (pure-JS, RN-safe). `privateKeyToPublic`
 * returns a compressed 33-byte public key.
 *
 * @throws SbtcError(INVALID_MNEMONIC) if the phrase is not a valid BIP39 mnemonic.
 */
export async function deriveAccount(mnemonic: string, network: NetworkMode): Promise<Account> {
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new SbtcError({ code: SbtcErrorCode.INVALID_MNEMONIC });
  }

  const seed = await mnemonicToSeed(mnemonic);
  const rootNode = HDKey.fromMasterSeed(seed);
  // `salt` is unused by our `Account`; computing it (deriveSalt) would require
  // @stacks/encryption's crypto lib, which is absent on native. Pass '' and skip.
  const account = deriveStacksAccount({
    rootNode,
    index: 0,
    salt: '',
    stxDerivationType: DerivationType.Wallet,
  });

  const address = getStxAddress({ account, network });
  // privateKeyToPublic returns a compressed 33-byte key; typed as string | bytes.
  const pub = privateKeyToPublic(account.stxPrivateKey);
  const publicKeyBytes = typeof pub === 'string' ? hex.decode(pub) : pub;
  const publicKey = typeof pub === 'string' ? pub : hex.encode(pub);
  const btcAddress = p2wpkh(publicKeyBytes, network === 'mainnet' ? NETWORK : TEST_NETWORK).address;

  return { address, btcAddress, publicKey, index: 0 };
}
