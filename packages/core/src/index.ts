// Public API barrel for @sbtc/sdk.
//
// Populated across M1 — only the symbols listed in PRD §9.1 are exported here.
// Internal modules (emily.ts, adapter internals, storage.ts) are NOT exported.
// Full wiring in T024.

// Errors (PRD §9.1)
export { SbtcError, SbtcErrorCode } from './errors';

// Adapter interfaces (PRD §9.1). `WalletApp` is also exported — it is transitively
// public via `ConnectAdapter.getAvailableWallets` though §9.1 omits it.
export type {
  PlatformAdapter,
  StorageAdapter,
  AuthAdapter,
  ConnectAdapter,
  WalletApp,
} from './adapters/types';

// Auth guard (PRD §9.1)
export { withAuthGuard } from './adapters/auth-guard';

// Built-in adapters for custom-adapter authors (PRD §9.1). `detectAdapter` and
// `SsrAdapter` are intentionally NOT exported — they are internal to SbtcProvider.
export { NativeAdapter } from './adapters/native';
export { WebAdapter } from './adapters/web';

// Provider + context (PRD §9.1)
export { SbtcProvider } from './provider/SbtcProvider';
export { useSbtcContext } from './provider/context';
export type { SbtcProviderProps, NetworkMode, SbtcContextValue } from './provider/types';
