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
// TODO(M4 T043): export { formatSats, formatBtc, satsToBtc, btcToSats } from './utils/format';
// TODO(M4 T044): export { isValidStxAddress, isValidBtcAddress } from './utils/address';
// TODO(M4 T045): export { getFeeEstimate } from './utils/fees';

// ---- Wallet (PRD §9.1) — M2 ----
export { useStacksWallet } from './wallet/useStacksWallet';
export type { WalletState, Account } from './wallet/types';

// ---- sBTC (PRD §9.1) — M4–M6 ----
// TODO(M4 T048): export { useSbtcBalance } from './sbtc/useSbtcBalance';
// TODO(M5 T055): export { useSbtcDeposit } from './sbtc/useSbtcDeposit';
// TODO(M6 T059): export { useSbtcWithdraw } from './sbtc/useSbtcWithdraw';
// TODO(M5 T054): export type { DepositStatus, WithdrawalStatus } from './sbtc/types';

// ---- Contracts (PRD §9.1) — M4 / M7 ----
// TODO(M4 T046): export { useStxBalance } from './contracts/useStxBalance';
// TODO(M4 T047): export { useNonce } from './contracts/useNonce';
// TODO(M7 T063): export { useStacksContract } from './contracts/useStacksContract';
