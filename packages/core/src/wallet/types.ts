import type { SbtcError } from '../errors';

/** A derived HD account. v1 supports only account index 0 (PRD §5.3). */
export interface Account {
  /** Stacks address — `SP…` (mainnet) / `ST…` (testnet). */
  address: string;
  /** Bitcoin native-SegWit (p2wpkh) address — `bc1q…` / `tb1q…`. */
  btcAddress: string;
  /**
   * Compressed secp256k1 public key (33-byte, hex). v1 derives a single key for
   * account index 0, used for BOTH the Stacks account and the BTC p2wpkh address,
   * so this is the value to pass as `paymentPublicKey` (deposit) and
   * `stacksPublicKey` (withdraw). Public, non-sensitive.
   */
  publicKey: string;
  /** Zero-based HD account index. */
  index: number;
}

/** State exposed by {@link useStacksWallet}. */
export interface WalletState {
  /** Stacks address, or `null` when no wallet is loaded. */
  address: string | null;
  /** Bitcoin p2wpkh address, or `null` when no wallet is loaded. */
  btcAddress: string | null;
  /**
   * Compressed secp256k1 public key (hex) for account 0, or `null` when no wallet
   * is loaded. Pass to `useSbtcDeposit` (`paymentPublicKey`) / `useSbtcWithdraw`
   * (`stacksPublicKey`). Non-sensitive.
   */
  publicKey: string | null;
  /** `true` once the initial load / generate / restore has settled. */
  isLoaded: boolean;
  /** `true` when a wallet exists but its keys are not held in memory. */
  isLocked: boolean;
  /** Last error (hooks never throw — they surface errors here). */
  error: SbtcError | null;
}
