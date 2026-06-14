/**
 * Error codes for every failure `@baoku26/sbtc-sdk` surfaces — one per row of PRD §9.3.
 *
 * Always reference the enum member, never the raw string (CLAUDE.md → Coding
 * Rules: "Enums for all status strings. No raw string literals in logic
 * branches."). The string values are stable and safe to log.
 */
export enum SbtcErrorCode {
  /** Native: `SbtcProvider` was mounted before `@baoku26/sbtc-sdk/polyfills` was imported. */
  POLYFILL_NOT_INITIALIZED = 'POLYFILL_NOT_INITIALIZED',
  /** A hook was used before a wallet was generated or restored. */
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  /** A sensitive operation was attempted on a locked wallet. */
  WALLET_LOCKED = 'WALLET_LOCKED',
  /** Biometric / WebAuthn authentication failed or was rejected by the user. */
  AUTH_FAILED = 'AUTH_FAILED',
  /** No authentication mechanism is available on this platform. */
  AUTH_UNAVAILABLE = 'AUTH_UNAVAILABLE',
  /** `restoreWallet` was called with an invalid BIP39 phrase. */
  INVALID_MNEMONIC = 'INVALID_MNEMONIC',
  /** A withdrawal was requested to a malformed BTC address. */
  INVALID_BTC_ADDRESS = 'INVALID_BTC_ADDRESS',
  /** The requested amount exceeds the available balance. */
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  /** The PSBT signing callback rejected or returned an invalid PSBT. */
  PSBT_SIGNING_FAILED = 'PSBT_SIGNING_FAILED',
  /** Stacks transaction signing failed or was rejected. */
  TX_SIGNING_FAILED = 'TX_SIGNING_FAILED',
  /** The Emily API returned a non-2xx response. */
  EMILY_API_ERROR = 'EMILY_API_ERROR',
  /** A deposit was below the 546 satoshi dust minimum. */
  DEPOSIT_BELOW_DUST = 'DEPOSIT_BELOW_DUST',
  /** A network request exceeded its timeout. */
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  /** A storage adapter read/write failed. */
  STORAGE_ERROR = 'STORAGE_ERROR',
  /** No supported wallet is installed / available. */
  WALLET_CONNECT_UNAVAILABLE = 'WALLET_CONNECT_UNAVAILABLE',
  /** An HTTP (non-HTTPS) endpoint was attempted. */
  NETWORK_SECURITY_ERROR = 'NETWORK_SECURITY_ERROR',
  /** A wallet operation was attempted during server-side render. */
  SSR_NOT_SUPPORTED = 'SSR_NOT_SUPPORTED',
}

/**
 * Documentation root. Updated to the Nextra docs site at M9 (T076+); points at
 * the repo README for now so error messages always carry an actionable link.
 */
const DOCS_URL = 'https://github.com/Baoku26/stacks-SDK#readme';

/**
 * Human-readable default message for each code, used when the caller does not
 * pass an explicit `message`. Typed as a total `Record` so the compiler forces
 * a message for every code (adding a code without a message is a type error).
 */
const DEFAULT_MESSAGES: Record<SbtcErrorCode, string> = {
  [SbtcErrorCode.POLYFILL_NOT_INITIALIZED]: `Native polyfills are not initialized. Import "@baoku26/sbtc-sdk/polyfills" as the very first line of your app entry file, before any other import. See ${DOCS_URL}`,
  [SbtcErrorCode.WALLET_NOT_FOUND]:
    'No wallet found. Call generateWallet() or restoreWallet() first.',
  [SbtcErrorCode.WALLET_LOCKED]: 'Wallet is locked. Unlock it before performing this operation.',
  [SbtcErrorCode.AUTH_FAILED]: 'Authentication failed or was cancelled.',
  [SbtcErrorCode.AUTH_UNAVAILABLE]: 'No authentication mechanism is available on this platform.',
  [SbtcErrorCode.INVALID_MNEMONIC]: 'The provided recovery phrase is not a valid BIP39 mnemonic.',
  [SbtcErrorCode.INVALID_BTC_ADDRESS]: 'The provided Bitcoin address is malformed.',
  [SbtcErrorCode.INSUFFICIENT_BALANCE]: 'The requested amount exceeds the available balance.',
  [SbtcErrorCode.PSBT_SIGNING_FAILED]: 'PSBT signing failed or returned an invalid PSBT.',
  [SbtcErrorCode.TX_SIGNING_FAILED]: 'Stacks transaction signing failed or was rejected.',
  [SbtcErrorCode.EMILY_API_ERROR]: 'The Emily API returned an error.',
  [SbtcErrorCode.DEPOSIT_BELOW_DUST]: 'Deposit amount is below the 546 satoshi dust minimum.',
  [SbtcErrorCode.NETWORK_TIMEOUT]: 'The network request timed out.',
  [SbtcErrorCode.STORAGE_ERROR]: 'A secure storage read or write failed.',
  [SbtcErrorCode.WALLET_CONNECT_UNAVAILABLE]: 'No supported wallet is installed or available.',
  [SbtcErrorCode.NETWORK_SECURITY_ERROR]: 'Refusing to use a non-HTTPS endpoint.',
  [SbtcErrorCode.SSR_NOT_SUPPORTED]:
    'This operation is not supported during server-side rendering.',
};

/** Options accepted by the {@link SbtcError} constructor. Internal — not part of the public API (PRD §9.1). */
interface SbtcErrorOptions {
  code: SbtcErrorCode;
  /** Overrides the default message for the code. Never include key material (SR-2). */
  message?: string;
  /** The underlying error this wraps, if any. `unknown` per the FFI-boundary rule. */
  originalError?: unknown;
  /** Non-sensitive structured context for debugging (txids, addresses, amounts). */
  context?: Record<string, unknown>;
  /** Which adapter the error originated from, when applicable. */
  platform?: 'native' | 'web';
}

/** V8-only `Error.captureStackTrace`, narrowly typed so we avoid `any`. */
interface ErrorConstructorWithCapture {
  captureStackTrace?(targetObject: object, constructorOpt?: unknown): void;
}

/**
 * The single error type the SDK throws or returns. Shape per PRD §11.2.
 *
 * Hooks never throw this — they surface it via their `error` field. It is thrown
 * only from imperative actions (e.g. `withAuthGuard`, adapter methods) and caught
 * at the hook boundary.
 */
export class SbtcError extends Error {
  readonly code: SbtcErrorCode;
  readonly originalError?: unknown;
  readonly context?: Record<string, unknown>;
  readonly platform?: 'native' | 'web';

  constructor(options: SbtcErrorOptions) {
    super(options.message ?? DEFAULT_MESSAGES[options.code]);

    this.name = 'SbtcError';
    this.code = options.code;
    this.originalError = options.originalError;
    this.context = options.context;
    this.platform = options.platform;

    // Restore the prototype chain so `instanceof SbtcError` survives down-leveling
    // by esbuild/tsup and the Hermes engine on React Native.
    Object.setPrototypeOf(this, SbtcError.prototype);

    // Drop the constructor frame from the stack on V8 (Node, Chrome).
    const errorCtor = Error as unknown as ErrorConstructorWithCapture;
    if (typeof errorCtor.captureStackTrace === 'function') {
      errorCtor.captureStackTrace(this, SbtcError);
    }
  }
}
