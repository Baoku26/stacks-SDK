// Public API barrel for @sbtc/sdk — exports exactly the symbols in PRD §9.1.
//
// Internal modules are deliberately NOT exported: `detect.ts`, `ssr.ts`, the
// `SbtcContext` object, `emily.ts`, `storage.ts`, adapter internals, and
// `utils/network` internals (`NetworkConfig`, `resolveApiConfig`).
//
// Sections below are wired as their milestones land; each pending line is mapped
// to its task. Adding an export before its module exists would break the build.

// ---- Provider + context (PRD §9.1) ----
export { SbtcProvider } from './provider/SbtcProvider';
export { useSbtcContext } from './provider/context';
export type { SbtcProviderProps, NetworkMode, SbtcContextValue } from './provider/types';

// ---- Adapters (PRD §9.1) ----
// `WalletApp` is also exported — transitively public via
// `ConnectAdapter.getAvailableWallets`, though §9.1's list omits it.
export type {
  PlatformAdapter,
  StorageAdapter,
  AuthAdapter,
  ConnectAdapter,
  WalletApp,
} from './adapters/types';
export { NativeAdapter } from './adapters/native';
export { WebAdapter } from './adapters/web';
export { withAuthGuard } from './adapters/auth-guard';

// ---- Errors (PRD §9.1) ----
export { SbtcError, SbtcErrorCode } from './errors';

// ---- Utils (PRD §9.1) ----
export { MAINNET, TESTNET } from './utils/network';
export { formatSats, formatBtc, satsToBtc, btcToSats } from './utils/format';
export { isValidStxAddress, isValidBtcAddress } from './utils/address';
export { getFeeEstimate } from './utils/fees';
export type { FeeEstimate } from './utils/fees';

// ---- Wallet (PRD §9.1) — M2 ----
export { useStacksWallet } from './wallet/useStacksWallet';
export type { WalletState, Account } from './wallet/types';

// ---- sBTC (PRD §9.1) — M4–M6 ----
export { useSbtcBalance } from './sbtc/useSbtcBalance';
export type { UseSbtcBalanceResult } from './sbtc/useSbtcBalance';
export { useSbtcDeposit } from './sbtc/useSbtcDeposit';
export type { UseSbtcDepositConfig, UseSbtcDepositResult } from './sbtc/useSbtcDeposit';
export { useSbtcWithdraw } from './sbtc/useSbtcWithdraw';
export type { UseSbtcWithdrawConfig, UseSbtcWithdrawResult } from './sbtc/useSbtcWithdraw';
export { DepositStatus, WithdrawalStatus } from './sbtc/types';

// ---- Contracts (PRD §9.1) — M4 / M7 ----
export { useStxBalance } from './contracts/useStxBalance';
export type { UseStxBalanceResult } from './contracts/useStxBalance';
export { useNonce } from './contracts/useNonce';
export type { UseNonceResult } from './contracts/useNonce';
export { useStacksContract } from './contracts/useStacksContract';
export type {
  UseStacksContractConfig,
  UseStacksContractResult,
  ReadOnlyQuery,
  ContractCallOptions,
} from './contracts/useStacksContract';
