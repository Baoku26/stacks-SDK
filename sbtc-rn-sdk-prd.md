# Product Requirements Document
# `@sbtc/sdk` — Universal React SDK for sBTC & Stacks

**Version:** 1.0.0
**Status:** Draft
**Author:** DML
**Last Updated:** June 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Users & Personas](#4-users--personas)
5. [Scope](#5-scope)
6. [Adapter Architecture](#6-adapter-architecture)
7. [Functional Requirements](#7-functional-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [API Specification](#9-api-specification)
10. [Security Requirements](#10-security-requirements)
11. [Error Handling](#11-error-handling)
12. [Testing Requirements](#12-testing-requirements)
13. [Milestones & Delivery](#13-milestones--delivery)
14. [Dependencies & Risks](#14-dependencies--risks)
15. [Out of Scope](#15-out-of-scope)

---

## 1. Executive Summary

`@sbtc/sdk` is an open-source TypeScript SDK that gives **any React developer** — whether building for web or mobile — a first-class way to integrate sBTC and the Stacks network into their application. One package, one API, one install. Platform differences in storage, authentication, and wallet connection are handled internally via a pluggable adapter system that auto-detects the runtime environment.

On **React Native / Expo**, the SDK wires the necessary Node.js polyfills, stores keys in the device's Secure Enclave via `expo-secure-store`, gates sensitive actions behind biometrics, and connects to mobile wallets (Leather, Xverse) via deep-links.

On **React (web)**, the SDK uses `localStorage` + `crypto.subtle` for encrypted storage, WebAuthn for auth, and `@stacks/connect` for browser extension wallet popups.

The hook API — `useStacksWallet`, `useSbtcDeposit`, `useSbtcWithdraw`, `useSbtcBalance`, `useStacksContract` — is identical on both platforms. Developers who build a web app today can ship a React Native app tomorrow using the exact same hook calls.

---

## 2. Problem Statement

### 2.1 Two Separate Gaps, One Package

**Gap 1 — Mobile:** The Stacks ecosystem has zero first-party mobile SDKs. Getting `@stacks/transactions` or `sbtc` running on React Native requires manually installing and wiring 6+ polyfill packages, configuring Metro bundler, building a custom secure storage layer, implementing Emily API polling, and handling mobile wallet deep-links from scratch. Every mobile developer hits this wall independently.

**Gap 2 — Web:** Existing web tooling (`sbtc`, `@stacks/connect`, `@stacks/transactions`) is functional but low-level. There are no React hooks. Developers write their own state management, polling logic, error handling, and loading states for every sBTC operation — work that is identical across every project.

**The compounding problem:** A team building both a web app and a mobile app today must use completely different toolchains, implement the same business logic twice, and maintain two separate integration layers against the same Stacks APIs.

### 2.2 Why This Matters Now

- sBTC TVL reached $545M in Q1 2026 — capital is ready, developer tooling is not keeping pace
- Stacks is the #5 fastest-growing developer community per Electric Capital 2025 — new developers arriving and hitting this tooling wall daily
- Mobile is the primary crypto interface in Africa, Southeast Asia, and Latin America — Stacks's next growth markets
- The Stacks Endowment 2026 grants program explicitly prioritizes sBTC library expansion and developer tooling

### 2.3 Current Workarounds & Their Failures

| Workaround | Problem |
|---|---|
| `sbtc` npm package (web) | No React hooks, no state management, no polling |
| `@stacks/connect` (web) | Wallet connection only — no sBTC flows, no hooks |
| Official RN docs (mobile) | Incomplete — no storage, no hooks, no sBTC |
| `@double-spent/sbtc-core` | Web-only, no React Native, no hooks |
| Build it yourself | Duplicated across every project, not maintained |

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

- **G1:** One install works on React Native and React web — zero platform-specific configuration required from the consumer
- **G2:** Reduce time-to-first-sBTC-transaction from ~8 hours (native) / ~3 hours (web) to under 30 minutes on both platforms
- **G3:** Provide a stable, typed, documented API covering the full sBTC lifecycle on both platforms
- **G4:** Become the canonical SDK referenced in official Stacks documentation for React developers

### 3.2 Success Metrics

| Metric | Target (6 months post-launch) |
|---|---|
| npm weekly downloads | 800+ |
| GitHub stars | 300+ |
| GitHub issues from external devs | 30+ (active adoption signal) |
| Stacks apps built using SDK | 8+ documented |
| Official Stacks docs reference | Merged within 60 days of v1.0 |
| Grant milestone completion | 100% on-time |

---

## 4. Users & Personas

### 4.1 Primary — The React / React Native Developer Building on Stacks

Knows TypeScript, React hooks, and async state management well. May be new to Bitcoin primitives (PSBTs, UTXOs) and Clarity contracts. Building a DeFi app, a wallet, or a Bitcoin-native product on Stacks. Wants to ship on both web and mobile without learning two different integration patterns.

**Pain today:** Spends days on platform setup before writing any product logic. Builds the same polling and error-handling boilerplate from scratch on every project.

### 4.2 Secondary — The Web Stacks Team Adding a Mobile App

Already has a working web dApp using `sbtc` + `@stacks/connect`. Wants to ship an iOS/Android companion without rebuilding the entire integration layer. Needs the same contract addresses, network config, and hook patterns to work on mobile.

### 4.3 Tertiary — The Bitcoin-Native User (indirectly served)

End user of apps built on this SDK. Holds BTC. Wants productive DeFi yield without leaving their preferred interface — mobile or browser. Should never know the SDK exists.

---

## 5. Scope

### 5.1 In Scope — v1.0

- Platform adapter system (`PlatformAdapter` interface + `NativeAdapter` + `WebAdapter`)
- Auto-detection of platform in `SbtcProvider`
- Custom adapter override via `SbtcProvider` prop
- Polyfill bundle (native only — web doesn't need it)
- `SbtcProvider` context and configuration
- `useStacksWallet` — wallet generation, restoration, secure storage, locking
- `useSbtcBalance` — real-time sBTC balance (both platforms)
- `useStxBalance` — real-time STX balance (both platforms)
- `useSbtcDeposit` — full BTC→sBTC deposit flow (both platforms)
- `useSbtcWithdraw` — full sBTC→BTC withdrawal flow (both platforms)
- `useStacksContract` — Clarity read-only calls and contract-call builder
- `useNonce` — account nonce helper
- Auth guard — biometrics (native) / WebAuthn (web) / passcode fallback
- Wallet connect — deep-links (native) / Stacks Connect popup (web)
- Utility functions: address formatting, unit conversion, fee estimation
- Metro bundler config template (native)
- Two example apps: Expo (native) + Next.js (web), both on testnet
- Docs site with unified API reference and platform-specific guides
- TypeScript type exports for all public APIs including adapter interfaces
- Unit tests for all hooks, adapters, and utilities

### 5.2 In Scope — v1.1

- `useStackingPool` — STX stacking delegation hooks
- WalletConnect v2 protocol support (web + native)
- React Query (`@tanstack/react-query`) adapter
- Hardware wallet support (Ledger via WebUSB on web, Bluetooth on native)

### 5.3 Out of Scope

- Native Swift / Kotlin modules — Expo JS layer only
- Consumer wallet UI components
- Custodial key management
- Price feeds or portfolio tracking
- Push notifications
- Fiat on-ramp integrations
- Multi-account HD wallet (v1.0 is account index 0 only)
- SIP-009/010 NFT support

---

## 6. Adapter Architecture

### 6.1 PlatformAdapter Interface

The adapter is the single seam between platform-agnostic hook logic and platform-specific implementation. Three sub-adapters cover the three divergent concerns:

```ts
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

interface AuthAdapter {
  isAvailable(): Promise<boolean>;
  prompt(reason: string): Promise<boolean>;
}

interface ConnectAdapter {
  signPsbt(psbt: Uint8Array): Promise<Uint8Array>;
  signStacksTx(serializedTx: Uint8Array): Promise<Uint8Array>;
  getAvailableWallets(): Promise<WalletApp[]>;
}

interface PlatformAdapter {
  platform: 'native' | 'web';
  storage: StorageAdapter;
  auth: AuthAdapter;
  connect: ConnectAdapter;
}
```

### 6.2 NativeAdapter (React Native / Expo)

| Concern | Implementation |
|---|---|
| Storage | `expo-secure-store` — hardware-backed encryption via Secure Enclave (iOS) / Keystore (Android) |
| Auth | `expo-local-authentication` — FaceID, fingerprint, or device passcode |
| Connect | Deep-link URI to Leather / Xverse mobile. `Linking.openURL()` + return callback via app URL scheme |

### 6.3 WebAdapter (React / Browser)

| Concern | Implementation |
|---|---|
| Storage | `localStorage` entry encrypted with AES-GCM key derived via `crypto.subtle.deriveKey` (PBKDF2). Key stored in `sessionStorage` during session, re-derived on reload |
| Auth | WebAuthn `navigator.credentials.get()` for platforms that support it; falls back to a passphrase prompt if WebAuthn is unavailable |
| Connect | `@stacks/connect` `openPsbtRequestPopup` / `openContractCall` — standard Leather / Xverse browser extension popup flow |

### 6.4 Auto-Detection Logic

```ts
// src/adapters/detect.ts
import { Platform } from 'react-native'; // tree-shaken on web builds

export function detectAdapter(): PlatformAdapter {
  // React Native / Expo
  if (typeof Platform !== 'undefined' && Platform.OS !== 'web') {
    return new NativeAdapter();
  }
  // Browser
  if (typeof window !== 'undefined') {
    return new WebAdapter();
  }
  // SSR (Next.js server) — return a no-op adapter; hooks should not run server-side
  return new SsrAdapter();
}
```

### 6.5 SSR Safety (Next.js)

The `SsrAdapter` is a no-op adapter for Next.js server-side rendering. All hooks return `{ isLoading: true }` during SSR and hydrate correctly on the client. No wallet operations execute server-side — this is by design and by security requirement.

### 6.6 Custom Adapter

Consumers who need a different storage or signing flow (custom HSM, hardware wallet, enterprise key management) can implement `PlatformAdapter` and pass it directly:

```tsx
<SbtcProvider network="mainnet" adapter={myEnterpriseAdapter}>
```

---

## 7. Functional Requirements

### 7.1 Platform Detection & Provider

**FR-1.1** `SbtcProvider` must auto-detect the platform on mount and select the appropriate adapter without any consumer configuration.

**FR-1.2** The provider must accept an optional `adapter` prop that overrides auto-detection.

**FR-1.3** The provider must accept `network: 'mainnet' | 'testnet'` and configure all child hooks accordingly.

**FR-1.4** The provider must accept an optional `apiConfig` prop to override default Hiro, Emily, and Bitcoin API endpoints.

**FR-1.5** During Next.js SSR, all hooks must return safe loading states and must not attempt any storage, auth, or network operations.

**FR-1.6** If polyfills are required (native) but have not been imported, the provider must throw `SbtcError(POLYFILL_NOT_INITIALIZED)` with a link to the docs.

---

### 7.2 Polyfills (Native Only)

**FR-2.1** The package must export a `polyfills` entry point (`@sbtc/sdk/polyfills`) that initializes all required globals on React Native.

**FR-2.2** The polyfill entry must be idempotent — safe to import multiple times.

**FR-2.3** On web, importing `@sbtc/sdk/polyfills` must be a no-op (the browser already has these globals).

---

### 7.3 Storage Adapter

**FR-3.1** `NativeAdapter.storage` must use `expo-secure-store` for all key/value storage. Values must be hardware-encrypted.

**FR-3.2** `WebAdapter.storage` must encrypt all values with AES-GCM before writing to `localStorage`. Encryption key must be derived via PBKDF2 using `crypto.subtle`.

**FR-3.3** Both adapters must wrap storage errors as `SbtcError(STORAGE_ERROR)`.

**FR-3.4** `WebAdapter.storage` must handle `localStorage` quota errors gracefully and surface them as `STORAGE_ERROR`.

---

### 7.4 Auth Adapter

**FR-4.1** `NativeAdapter.auth.prompt()` must invoke `expo-local-authentication` biometric prompt. On failure: `SbtcError(BIOMETRIC_FAILED)`. On unavailability: `SbtcError(BIOMETRIC_UNAVAILABLE)`.

**FR-4.2** `WebAdapter.auth.prompt()` must invoke the WebAuthn API (`navigator.credentials.get`). If WebAuthn is unavailable, it must fall back to a passphrase confirmation dialog.

**FR-4.3** `AuthAdapter.isAvailable()` must return `true` if any auth mechanism (biometric, passcode, WebAuthn, or passphrase fallback) is available. It must return `false` only if no auth mechanism exists on the platform.

**FR-4.4** The `withAuthGuard(fn)` utility must call `auth.prompt()` before executing `fn`. If auth fails or is unavailable, `fn` must not be called.

---

### 7.5 Connect Adapter

**FR-5.1** `NativeAdapter.connect.signPsbt(psbt)` must encode the PSBT as base64, open the target wallet app via deep-link, and resolve the returned signed PSBT from the callback URL.

**FR-5.2** `WebAdapter.connect.signPsbt(psbt)` must use `@stacks/connect` `openPsbtRequestPopup` to request signing from the browser extension wallet.

**FR-5.3** `NativeAdapter.connect.signStacksTx(tx)` must deep-link to the wallet for signing and resolve the signed transaction from the callback.

**FR-5.4** `WebAdapter.connect.signStacksTx(tx)` must use `@stacks/connect` `openContractCall` or `openSTXTransfer` as appropriate.

**FR-5.5** `ConnectAdapter.getAvailableWallets()` must return the list of supported wallets that are installed / available on the current platform. On native: checks URL scheme availability. On web: checks for `window.StacksProvider` or equivalent extension detection.

**FR-5.6** If no wallet is available, `ConnectAdapter` methods must throw `SbtcError(WALLET_CONNECT_UNAVAILABLE)` with platform-appropriate installation guidance.

---

### 7.6 useStacksWallet

**FR-6.1** `generateWallet()` must produce a valid BIP39 mnemonic, derive a Stacks HD wallet, derive both STX and BTC (p2wpkh) addresses, and persist the encrypted mnemonic via `adapter.storage`.

**FR-6.2** `restoreWallet(mnemonic)` must validate the mnemonic, derive the same addresses deterministically, and persist.

**FR-6.3** `lockWallet()` must clear the in-memory private key. The encrypted store entry must remain intact.

**FR-6.4** `exportMnemonic()` must call `withAuthGuard` before returning the plaintext mnemonic.

**FR-6.5** `clearWallet()` must call `withAuthGuard` before removing wallet from storage and clearing state.

**FR-6.6** On mount, the hook must attempt auto-restore from storage. If a wallet entry exists, the wallet state is restored without requiring user input.

---

### 7.7 useSbtcBalance, useStxBalance, useNonce

**FR-7.1** `useSbtcBalance(address)` must return sBTC balance in satoshis and as a formatted BTC string, polling at a configurable interval (default 30s).

**FR-7.2** `useStxBalance(address)` must return STX balance in microSTX and as a formatted STX string.

**FR-7.3** `useNonce(address)` must always return the pending nonce fresh from the Hiro API — never cached.

**FR-7.4** All balance hooks must expose `isLoading`, `isRefreshing`, `error`, and `refresh()`.

---

### 7.8 useSbtcDeposit

**FR-8.1** `deposit(amountSats)` must validate `amountSats >= 546` before proceeding.

**FR-8.2** If no `signPsbt` override is provided, the hook must use `adapter.connect.signPsbt` automatically.

**FR-8.3** After broadcast, the hook must poll the Emily API at 15-second intervals with exponential backoff on error.

**FR-8.4** The hook must expose `status`: `'idle' | 'building' | 'signing' | 'broadcasting' | 'pending' | 'confirmed' | 'failed'`.

**FR-8.5** The hook must expose `txid` (Bitcoin txid), `onSuccess`, `onError`, and `reset()`.

---

### 7.9 useSbtcWithdraw

**FR-9.1** `withdraw(amountSats, btcAddress)` must validate the BTC address format before proceeding.

**FR-9.2** If no `signTx` override is provided, the hook must use `adapter.connect.signStacksTx` automatically.

**FR-9.3** After the Stacks transaction is confirmed, the hook must poll Emily API for BTC release status.

**FR-9.4** The hook must expose `status`, `stacksTxid`, `btcTxid`, `estimatedConfirmationMinutes`, and `reset()`.

---

### 7.10 useStacksContract

**FR-10.1** Read-only calls must accept `contract`, `fn`, `args` and return decoded Clarity value.

**FR-10.2** Contract calls must use `adapter.connect.signStacksTx` for signing unless a `signTx` override is provided.

**FR-10.3** The hook must expose `data`, `isLoading`, `error`, `refetch`, and `call()`.

---

## 8. Non-Functional Requirements

### 8.1 Performance

**NFR-1.1** Total bundle size added to a web app: ≤ 60KB gzipped (excluding `sbtc` and `@stacks/` peer dependencies).

**NFR-1.2** Native polyfill bundle: ≤ 80KB gzipped.

**NFR-1.3** `NativeAdapter` and `WebAdapter` implementations must be tree-shaken in the opposing platform's build. A web bundle must not include `expo-secure-store` code; a native bundle must not include WebAuthn code.

**NFR-1.4** All API polling uses exponential backoff on failure (15s → 30s → 60s → 120s → 300s max).

### 8.2 Compatibility

**NFR-2.1** React Native: Expo SDK 51+, RN 0.73+, iOS 15+, Android API 26+.

**NFR-2.2** Web: React 18+, modern evergreen browsers (Chrome 90+, Firefox 90+, Safari 15+).

**NFR-2.3** Next.js: 13+ (App Router and Pages Router both supported). SSR-safe.

**NFR-2.4** Must work in Expo managed workflow without ejecting.

**NFR-2.5** Compatible with both React Native new architecture (Fabric/JSI) and legacy bridge.

### 8.3 Developer Experience

**NFR-3.1** All public APIs fully typed. No `any` in exported interfaces.

**NFR-3.2** Every hook returns a consistent shape: `{ data?, isLoading, error, ...actions }`.

**NFR-3.3** Error objects include `code` (enum), `message` (human-readable), and `originalError`.

**NFR-3.4** Platform adapter interfaces exported so custom adapter authors have full TypeScript support.

**NFR-3.5** Tree-shaking must work correctly — importing only `useSbtcBalance` must not bundle deposit or withdrawal code.

### 8.4 SSR Safety

**NFR-4.1** No hook may access `window`, `document`, `localStorage`, or any browser/device API during server-side rendering.

**NFR-4.2** `SsrAdapter` must be the auto-detected adapter in any non-browser, non-React-Native environment.

**NFR-4.3** Hydration mismatches must not occur — SSR loading state and client initial state must match.

---

## 9. API Specification

### 9.1 Public Exports

```ts
// Provider + context
export { SbtcProvider } from './provider/SbtcProvider';
export { useSbtcContext } from './provider/context';
export type { SbtcProviderProps, NetworkMode, SbtcContextValue } from './provider/types';

// Adapters — interfaces exported for custom adapter authors
export type { PlatformAdapter, StorageAdapter, AuthAdapter, ConnectAdapter } from './adapters/types';
export { NativeAdapter } from './adapters/native';
export { WebAdapter } from './adapters/web';

// Auth guard
export { withAuthGuard } from './adapters/auth-guard';

// Wallet
export { useStacksWallet } from './wallet/useStacksWallet';
export type { WalletState, Account } from './wallet/types';

// sBTC
export { useSbtcBalance } from './sbtc/useSbtcBalance';
export { useSbtcDeposit } from './sbtc/useSbtcDeposit';
export { useSbtcWithdraw } from './sbtc/useSbtcWithdraw';
export type { DepositStatus, WithdrawalStatus } from './sbtc/types';

// Contracts
export { useStacksContract } from './contracts/useStacksContract';
export { useStxBalance } from './contracts/useStxBalance';
export { useNonce } from './contracts/useNonce';

// Errors
export { SbtcError, SbtcErrorCode } from './errors';

// Utils
export { formatSats, formatBtc, satsToBtc, btcToSats } from './utils/format';
export { isValidStxAddress, isValidBtcAddress } from './utils/address';
export { getFeeEstimate } from './utils/fees';
export { MAINNET, TESTNET } from './utils/network';
```

### 9.2 SbtcProvider Props

```ts
interface SbtcProviderProps {
  network: 'mainnet' | 'testnet';
  adapter?: PlatformAdapter;        // overrides auto-detection
  apiConfig?: {
    hiroApiUrl?: string;
    emilyApiUrl?: string;
    bitcoinApiUrl?: string;
  };
  children: React.ReactNode;
}
```

### 9.3 Error Codes

| Code | Trigger |
|---|---|
| `POLYFILL_NOT_INITIALIZED` | Native: SbtcProvider mounted before polyfills imported |
| `WALLET_NOT_FOUND` | Hook called before wallet is generated or restored |
| `WALLET_LOCKED` | Sensitive operation on locked wallet |
| `AUTH_FAILED` | Biometric / WebAuthn authentication failed |
| `AUTH_UNAVAILABLE` | No auth mechanism available on this platform |
| `INVALID_MNEMONIC` | `restoreWallet` called with invalid BIP39 phrase |
| `INVALID_BTC_ADDRESS` | Withdrawal called with malformed BTC address |
| `INSUFFICIENT_BALANCE` | Amount exceeds available balance |
| `PSBT_SIGNING_FAILED` | Signing callback rejected or returned invalid PSBT |
| `TX_SIGNING_FAILED` | Stacks transaction signing failed or rejected |
| `EMILY_API_ERROR` | Emily API returned non-2xx |
| `DEPOSIT_BELOW_DUST` | Deposit below 546 satoshi minimum |
| `NETWORK_TIMEOUT` | API call exceeded timeout |
| `STORAGE_ERROR` | Storage adapter read/write failure |
| `WALLET_CONNECT_UNAVAILABLE` | No supported wallet installed / available |
| `NETWORK_SECURITY_ERROR` | HTTP (non-HTTPS) endpoint attempted |
| `SSR_NOT_SUPPORTED` | Wallet operation attempted during server-side render |

---

## 10. Security Requirements

**SR-1** Private keys must never be stored in plaintext on any platform.
- Native: `expo-secure-store` (Secure Enclave / Android Keystore)
- Web: `localStorage` value encrypted with AES-GCM via `crypto.subtle`

**SR-2** Private keys and mnemonics must never appear in logs, error messages, or any external API call on any platform.

**SR-3** All sensitive operations (export mnemonic, clear wallet, sign transaction) must be gated behind `withAuthGuard` on both platforms.

**SR-4** On web, the AES-GCM encryption key must not be persisted to `localStorage`. It may be held in `sessionStorage` for session duration or re-derived on each app load from a user passphrase.

**SR-5** WebAuthn credentials used for auth must be created with `userVerification: 'required'` to ensure biometric or PIN verification occurs.

**SR-6** Deep-link return URLs on native must validate that the response scheme and host match the registered callback before resolving the signing promise.

**SR-7** The `WebAdapter.connect` layer must verify the signing origin (extension `window.StacksProvider`) before submitting transactions.

**SR-8** No HTTP endpoints. All network requests must use HTTPS. Throw `NETWORK_SECURITY_ERROR` otherwise.

**SR-9** `SsrAdapter` must be a complete no-op for storage and auth — no data persisted, no auth prompted, no keys in memory during SSR.

**SR-10** PSBT integrity check: the hook must hash the unsigned PSBT before signing and verify the signed PSBT's inputs are unchanged before broadcasting.

---

## 11. Error Handling

### 11.1 Design Principles

- Every async hook operation returns `{ data, error }` — the SDK never throws uncaught exceptions in normal operation
- Errors are typed instances of `SbtcError` with a `code` from `SbtcErrorCode`
- Status machine hooks (`useSbtcDeposit`, `useSbtcWithdraw`) stay in `failed` state until `reset()` is called
- Network failures during polling trigger retry with backoff, not immediate `failed`

### 11.2 Error Class

```ts
class SbtcError extends Error {
  code: SbtcErrorCode;
  message: string;
  originalError?: unknown;
  context?: Record<string, unknown>;
  platform?: 'native' | 'web';     // which adapter the error originated from
}
```

---

## 12. Testing Requirements

### 12.1 Unit Tests

| Module | Coverage Target |
|---|---|
| `polyfills/` | 100% |
| `adapters/native/` | 95% |
| `adapters/web/` | 95% |
| `adapters/detect.ts` | 100% |
| `wallet/` | 95% |
| `sbtc/` | 90% |
| `contracts/` | 90% |
| `utils/` | 100% |

Each adapter must be tested independently. The native adapter tests mock `expo-secure-store` and `expo-local-authentication`. The web adapter tests mock `localStorage`, `crypto.subtle`, and `navigator.credentials`.

### 12.2 Integration Tests

- Testnet integration suite runs against real Stacks testnet on every PR
- Emily API mocked in unit tests; real testnet Emily in integration tests
- Full deposit and withdrawal flows tested end-to-end on testnet
- Next.js SSR tests: hooks render without errors during server-side pass

### 12.3 Manual QA Checklist (Pre-release)

**Native (Expo Go + physical devices):**
- [ ] Generate wallet → valid STX + BTC addresses
- [ ] Restore wallet → same addresses as reference
- [ ] Lock + unlock → private key clears on lock
- [ ] Export mnemonic → biometric fires
- [ ] sBTC balance on known testnet address
- [ ] Full deposit flow on testnet → confirmed
- [ ] Full withdrawal flow on testnet → BTC returned
- [ ] Deep-link to Leather → sign → return
- [ ] No keys in Metro logs at any point

**Web (Next.js, Chrome + Safari):**
- [ ] Generate wallet → valid addresses
- [ ] Restore wallet → deterministic addresses
- [ ] Export mnemonic → WebAuthn fires (or passphrase fallback)
- [ ] sBTC balance on known testnet address
- [ ] Full deposit flow on testnet (Leather extension) → confirmed
- [ ] Full withdrawal flow on testnet → BTC returned
- [ ] Stacks Connect popup opens correctly
- [ ] Next.js SSR: no hydration errors, no server-side storage access
- [ ] No keys in browser console at any point

---

## 13. Milestones & Delivery

| Milestone | Deliverable | Acceptance Criteria | Timeline |
|---|---|---|---|
| **M1** | Repo + adapter interfaces + polyfills + provider detection | Provider auto-detects native vs web. Polyfill guard fires on native. SSR adapter no-ops. | Week 1–2 |
| **M2** | `NativeAdapter` (storage, auth, connect) + `useStacksWallet` native | Wallet generates/restores/locks on Expo Go. Keys in Secure Enclave. | Week 3–4 |
| **M3** | `WebAdapter` (storage, auth, connect) + `useStacksWallet` web | Wallet generates/restores/locks in Next.js. Encrypted in localStorage. | Week 5–6 |
| **M4** | Balance hooks + `useNonce` (shared) | Correct live data from testnet on both platforms. | Week 7 |
| **M5** | `useSbtcDeposit` — both platforms | End-to-end deposit confirmed on testnet, native + web. | Week 8–9 |
| **M6** | `useSbtcWithdraw` — both platforms | End-to-end withdrawal confirmed on testnet, native + web. | Week 10–11 |
| **M7** | `useStacksContract` + utils | Read-only + contract calls work on both platforms. | Week 12 |
| **M8** | Example apps: Expo + Next.js | Both apps run on testnet in Expo Go and Vercel. | Week 13–14 |
| **M9** | Docs + npm publish | Docs live. `@sbtc/sdk@1.0.0` on npm. PR to Stacks docs. | Week 15–16 |

---

## 14. Dependencies & Risks

### 14.1 External Dependencies

| Dependency | Scope | Risk |
|---|---|---|
| `sbtc` | Both | Medium — upstream changes break PSBT building |
| `@stacks/transactions` | Both | Low — stable |
| `@stacks/wallet-sdk` | Both | Low — stable |
| `@stacks/connect` | Web only | Low — stable, widely used |
| `expo-secure-store` | Native only | Low — Expo official |
| `expo-local-authentication` | Native only | Low — Expo official |
| Emily API | Both | Medium — actively developed, endpoints may change |
| Hiro API | Both | Low — stable |
| WebAuthn API | Web only | Low — widely supported in target browsers |

### 14.2 Risks

**R1 — Emily API instability**
Emily is actively developed. Endpoints have changed before.
*Mitigation:* Entire Emily client isolated in `src/sbtc/emily.ts`. One file to update on any change.

**R2 — Tree-shaking adapter code**
If Metro or Webpack bundles both `NativeAdapter` and `WebAdapter` into the same output, bundle size grows significantly.
*Mitigation:* Use `tsup` conditional exports + test bundle output size as part of CI. Add a bundle size check step to `ci.yml`.

**R3 — WebAuthn availability on mobile browsers**
Some mobile browsers (particularly in-app browsers within wallet apps) may not support WebAuthn.
*Mitigation:* `WebAdapter.auth` must always have a passphrase fallback. `isAvailable()` returns `true` even when WebAuthn is absent, since the fallback covers it.

**R4 — Deep-link schema fragmentation**
Leather and Xverse mobile deep-link schemas can change with app updates.
*Mitigation:* Deep-link URIs isolated in `src/adapters/native/connect.ts`. Versioned URL scheme constants. Document that consumers must verify schemas against wallet changelogs.

**R5 — SSR hydration mismatches**
If the SSR pass renders different content than the client's initial render, React will throw hydration errors.
*Mitigation:* All hooks return `{ isLoading: true, data: null }` during SSR. Client hydration always starts from the same loading state. Test explicitly in M8.

---

## 15. Out of Scope

- **Consumer wallet UI** — no screens, no navigation, no design system
- **Native Swift / Kotlin modules** — Expo JS layer only
- **Custodial key management**
- **Stacking / PoX hooks** — v1.1
- **WalletConnect v2** — v1.1
- **Multi-account HD wallet** — v1.1 (account index 0 only in v1.0)
- **NFT / SIP-009/010 support**
- **Price feeds or portfolio tracking**
- **Push notifications**
- **Fiat on-ramp**
- **Server-side wallet operations** — all wallet logic is client-only
