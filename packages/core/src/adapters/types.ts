/**
 * The platform adapter contract — the single most important abstraction in the SDK.
 *
 * Every platform-specific operation (secure storage, user auth, wallet connect /
 * signing) goes through a `PlatformAdapter`. Hooks obtain it from
 * `useSbtcContext().adapter` and NEVER import `expo-secure-store`, `localStorage`,
 * `@stacks/connect`, etc. directly. Two built-in implementations ship with the
 * package — `NativeAdapter` and `WebAdapter` — plus a no-op `SsrAdapter`.
 *
 * See PLANNING.md → "Adapter Design" and MEMORY.md → [ADAPTERS].
 */

/**
 * A wallet app the user can sign with. Returned by
 * {@link ConnectAdapter.getAvailableWallets} so a UI can offer install guidance.
 */
export interface WalletApp {
  /** Display name, e.g. `'Leather'` or `'Xverse'`. */
  name: string;
  /** URL scheme used for native deep-linking and availability detection, e.g. `'leather'`. */
  scheme: string;
  /** App Store / Play Store / extension store URL, for "install this wallet" prompts. */
  storeUrl: string;
}

/**
 * Encrypted key/value storage. Native: `expo-secure-store` (hardware-backed).
 * Web: `localStorage` + AES-GCM. Errors are surfaced as `SbtcError(STORAGE_ERROR)`.
 */
export interface StorageAdapter {
  /** Returns the stored value for `key`, or `null` if absent. */
  get(key: string): Promise<string | null>;
  /** Stores `value` under `key`, encrypted at rest. */
  set(key: string, value: string): Promise<void>;
  /** Removes any value stored under `key`. */
  remove(key: string): Promise<void>;
}

/**
 * User authentication gate. Native: biometrics (`expo-local-authentication`).
 * Web: WebAuthn with a passphrase fallback. Used by `withAuthGuard`.
 */
export interface AuthAdapter {
  /**
   * Whether any auth mechanism is available. Returns `true` if biometrics,
   * device passcode, WebAuthn, OR the passphrase fallback is usable; `false`
   * only when no mechanism exists at all (PRD FR-4.3).
   */
  isAvailable(): Promise<boolean>;
  /**
   * Prompts the user to authenticate. Resolves `true` on success, `false` if the
   * user cancels or fails. `reason` is shown to the user (e.g. "Export recovery phrase").
   */
  prompt(reason: string): Promise<boolean>;
}

/**
 * Wallet connection and transaction signing UX. Native: deep-links to Leather /
 * Xverse. Web: `@stacks/connect` extension popups.
 */
export interface ConnectAdapter {
  /** Signs a Bitcoin PSBT and resolves the signed PSBT bytes. */
  signPsbt(psbt: Uint8Array): Promise<Uint8Array>;
  /** Signs a Stacks transaction and resolves the signed transaction bytes. */
  signStacksTx(tx: Uint8Array): Promise<Uint8Array>;
  /** Lists supported wallets that are installed / available on this platform. */
  getAvailableWallets(): Promise<WalletApp[]>;
}

/**
 * Composes the three sub-adapters and tags the platform. The instance lives on
 * the SDK context; hooks reach platform behaviour exclusively through it.
 * (The SSR no-op adapter reports `platform: 'web'`.)
 */
export interface PlatformAdapter {
  platform: 'native' | 'web';
  storage: StorageAdapter;
  auth: AuthAdapter;
  connect: ConnectAdapter;
}
