/**
 * Status machines for the sBTC bridge hooks (PRD FR-8.4 / FR-9.4). These are the
 * HOOK-level states the UI renders, distinct from Emily's wire status
 * (`PENDING → ACCEPTED → CONFIRMED | FAILED`, mapped internally in `emily.ts`).
 *
 * Enums per CLAUDE.md → Coding Rules ("Enums for all status strings").
 */

/** Lifecycle of a `useSbtcDeposit` operation. */
export enum DepositStatus {
  /** No deposit in progress (initial / after `reset()`). */
  IDLE = 'idle',
  /** Fetching signer key / UTXOs / fees and building the deposit transaction. */
  BUILDING = 'building',
  /** Awaiting the wallet's PSBT signature. */
  SIGNING = 'signing',
  /** Broadcasting the signed Bitcoin transaction and notifying Emily. */
  BROADCASTING = 'broadcasting',
  /** Broadcast; awaiting sBTC mint (polling Emily). */
  PENDING = 'pending',
  /** sBTC minted — deposit confirmed. */
  CONFIRMED = 'confirmed',
  /** The deposit failed; stays here until `reset()`. */
  FAILED = 'failed',
}

/** Lifecycle of a `useSbtcWithdraw` operation (M6). */
export enum WithdrawalStatus {
  IDLE = 'idle',
  BUILDING = 'building',
  SIGNING = 'signing',
  BROADCASTING = 'broadcasting',
  /** Stacks tx submitted; awaiting BTC release (polling Emily). */
  PENDING = 'pending',
  /** BTC released — withdrawal confirmed. */
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}
