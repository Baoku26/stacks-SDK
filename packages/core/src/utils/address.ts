import { validateStacksAddress } from '@stacks/transactions';
import { Address, NETWORK, TEST_NETWORK } from '@scure/btc-signer';

/**
 * Address validation helpers. Pure and dependency-light (the two crypto libs are
 * already core runtime deps used by wallet derivation).
 */

/** True if `address` is a syntactically valid Stacks (`SP…`/`ST…`) address. */
export function isValidStxAddress(address: string): boolean {
  return validateStacksAddress(address);
}

/**
 * True if `address` is a valid Bitcoin address. With `network` set, validates
 * strictly against mainnet (`bc1…`/`1…`/`3…`) or testnet (`tb1…`/`m…`/`n…`/`2…`);
 * without it, accepts an address valid on either network.
 */
export function isValidBtcAddress(address: string, network?: 'mainnet' | 'testnet'): boolean {
  if (typeof address !== 'string' || address.length === 0) return false;
  const nets =
    network === 'mainnet'
      ? [NETWORK]
      : network === 'testnet'
        ? [TEST_NETWORK]
        : [NETWORK, TEST_NETWORK];
  return nets.some((net) => {
    try {
      Address(net).decode(address);
      return true;
    } catch {
      return false;
    }
  });
}
