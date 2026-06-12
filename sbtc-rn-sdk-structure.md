# `@sbtc/sdk` — Project Structure & Build Plan

> A universal React SDK for sBTC deposits, withdrawals, wallet management, and Stacks smart contract interactions — works on both **React Native / Expo** and **React (web)**. One install. One API. Platform differences handled internally via a pluggable adapter system.

---

## Overview

| Property | Value |
|---|---|
| **Package name** | `@sbtc/sdk` |
| **Runtime targets** | Expo (managed + bare), React Native CLI, React (web / Next.js / Vite) |
| **Language** | TypeScript |
| **Core dependencies** | `sbtc`, `@stacks/transactions`, `@stacks/wallet-sdk`, `@stacks/connect` |
| **Platform deps (native)** | `expo-secure-store`, `expo-local-authentication` |
| **Platform deps (web)** | `@stacks/connect` (Stacks Connect popup) |
| **License** | MIT |
| **Grant track** | Stacks Endowment — Builder Grant (up to $50k) |

---

## What this SDK provides that doesn't exist yet

1. **Universal platform support** — one package works in Expo, React Native CLI, Next.js, Vite, and CRA with zero configuration differences.
2. **Polyfill bundle (native only)** — Node.js shims auto-loaded on React Native; browser already has them natively.
3. **Platform adapter system** — storage, auth, and wallet-connect behaviors swap automatically based on detected platform. Consumers can override with a custom adapter.
4. **`useStacksWallet` hook** — generate/restore HD wallet, platform-appropriate key storage, expose STX + BTC addresses.
5. **`useSbtcDeposit` hook** — BTC→sBTC PSBT flow with platform-appropriate signing (deep-link on mobile, Stacks Connect on web) and Emily API polling.
6. **`useSbtcWithdraw` hook** — sBTC→BTC withdrawal through Stacks contract call + BTC confirmation polling.
7. **`useSbtcBalance` hook** — real-time sBTC balance from Hiro API.
8. **`useStacksContract` hook** — Clarity read-only calls and contract-call builder.
9. **`SbtcProvider`** — context provider that auto-detects platform, selects the correct adapter, and configures all child hooks.
10. **Auth guard** — biometrics on native (FaceID/fingerprint), WebAuthn on web, passcode fallback on both.
11. **Custom adapter support** — pass your own `PlatformAdapter` to `SbtcProvider` for advanced use cases (custom HSM, hardware wallet, etc.).

---

## Adapter Architecture

The three platform-divergent concerns are isolated behind a single `PlatformAdapter` interface:

```
PlatformAdapter
├── storage         — read/write/clear encrypted key material
├── auth            — prompt user authentication before sensitive actions
└── connect         — wallet connection and transaction signing UX
```

Two built-in implementations ship with the package:

| Adapter | Platform | Storage | Auth | Connect |
|---|---|---|---|---|
| `NativeAdapter` | React Native / Expo | `expo-secure-store` | `expo-local-authentication` | Deep-links (Leather / Xverse mobile) |
| `WebAdapter` | React (browser) | `localStorage` + `crypto.subtle` AES-GCM | WebAuthn API | Stacks Connect popup |

`SbtcProvider` detects platform via `Platform.OS` (React Native) / `typeof window` (web) and selects the adapter automatically. Consumers can override:

```tsx
<SbtcProvider network="mainnet" adapter={myCustomAdapter}>
```

---

## Repository Structure

```
@sbtc/sdk/
│
├── packages/
│   ├── core/                              # Main SDK package (@sbtc/sdk)
│   │   ├── src/
│   │   │   ├── index.ts                   # Public API barrel export
│   │   │   │
│   │   │   ├── polyfills/                 # Native-only: Node.js shims for Hermes
│   │   │   │   ├── index.ts               # Must be first import in RN entry point
│   │   │   │   ├── crypto.ts              # @peculiar/webcrypto + react-native-get-random-values
│   │   │   │   ├── buffer.ts              # buffer, process globals
│   │   │   │   └── streams.ts             # readable-stream alias
│   │   │   │
│   │   │   ├── adapters/                  # Platform abstraction layer
│   │   │   │   ├── types.ts               # PlatformAdapter interface
│   │   │   │   ├── detect.ts              # Auto-detect platform → return correct adapter
│   │   │   │   ├── native/
│   │   │   │   │   ├── index.ts           # NativeAdapter implementation
│   │   │   │   │   ├── storage.ts         # expo-secure-store wrapper
│   │   │   │   │   ├── auth.ts            # expo-local-authentication wrapper
│   │   │   │   │   └── connect.ts         # Leather / Xverse deep-link connect
│   │   │   │   └── web/
│   │   │   │       ├── index.ts           # WebAdapter implementation
│   │   │   │       ├── storage.ts         # localStorage + crypto.subtle AES-GCM
│   │   │   │       ├── auth.ts            # WebAuthn API wrapper
│   │   │   │       └── connect.ts         # @stacks/connect popup wrapper
│   │   │   │
│   │   │   ├── provider/
│   │   │   │   ├── SbtcProvider.tsx       # Context: detects platform, selects adapter
│   │   │   │   ├── context.ts             # createContext + useSbtcContext()
│   │   │   │   └── types.ts               # SbtcProviderProps, NetworkMode, SbtcContextValue
│   │   │   │
│   │   │   ├── wallet/
│   │   │   │   ├── useStacksWallet.ts     # Generate/restore wallet via adapter
│   │   │   │   └── types.ts               # WalletState, Account
│   │   │   │
│   │   │   ├── sbtc/
│   │   │   │   ├── useSbtcBalance.ts      # Poll sBTC balance (Hiro API)
│   │   │   │   ├── useSbtcDeposit.ts      # BTC → sBTC: PSBT + Emily polling
│   │   │   │   ├── useSbtcWithdraw.ts     # sBTC → BTC: contract call + BTC polling
│   │   │   │   ├── emily.ts               # Emily API client (internal)
│   │   │   │   └── types.ts               # DepositStatus, WithdrawalStatus
│   │   │   │
│   │   │   ├── contracts/
│   │   │   │   ├── useStacksContract.ts   # Clarity read-only + contract-call builder
│   │   │   │   ├── useStxBalance.ts       # STX balance hook
│   │   │   │   ├── useNonce.ts            # Account nonce helper
│   │   │   │   └── types.ts
│   │   │   │
│   │   │   ├── errors.ts                  # SbtcError class + SbtcErrorCode enum
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── format.ts              # sats ↔ BTC ↔ sBTC display formatting
│   │   │       ├── address.ts             # STX + BTC address validation
│   │   │       ├── fees.ts                # Fee rate helpers (low/medium/high)
│   │   │       └── network.ts             # MAINNET / TESTNET config constants
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── templates/
│   │       └── metro.config.js            # Copy into RN project root
│   │
│   ├── example-native/                    # Expo example app
│   │   ├── app/
│   │   │   ├── _layout.tsx                # SbtcProvider (auto-detects native)
│   │   │   ├── index.tsx                  # Wallet home: STX + sBTC balances
│   │   │   ├── deposit.tsx                # Deposit flow screen
│   │   │   ├── withdraw.tsx               # Withdrawal flow screen
│   │   │   └── settings.tsx               # Network toggle, wipe wallet
│   │   ├── polyfill.js                    # Polyfill import (native only)
│   │   ├── index.js                       # Entry point — imports polyfill first
│   │   └── package.json
│   │
│   └── example-web/                       # Next.js example app
│       ├── app/
│       │   ├── layout.tsx                 # SbtcProvider (auto-detects web)
│       │   ├── page.tsx                   # Wallet home
│       │   ├── deposit/page.tsx           # Deposit flow page
│       │   └── withdraw/page.tsx          # Withdrawal flow page
│       └── package.json
│
├── docs/                                  # Documentation site (Nextra)
│   ├── getting-started.mdx                # Unified — shows both platforms
│   ├── platform-adapters.mdx              # How the adapter system works
│   ├── polyfills.mdx                      # Native-only — the most common failure point
│   ├── hooks/
│   │   ├── use-stacks-wallet.mdx
│   │   ├── use-sbtc-deposit.mdx
│   │   ├── use-sbtc-withdraw.mdx
│   │   ├── use-sbtc-balance.mdx
│   │   └── use-stacks-contract.mdx
│   ├── provider.mdx
│   ├── custom-adapters.mdx                # How to write your own PlatformAdapter
│   ├── security.mdx
│   └── examples/
│       ├── expo-wallet.mdx
│       ├── nextjs-defi-app.mdx
│       └── contract-interaction.mdx
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── publish.yml
│   └── ISSUE_TEMPLATE/
│
├── package.json                           # Monorepo root (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## PlatformAdapter Interface

```ts
// src/adapters/types.ts

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface AuthAdapter {
  isAvailable(): Promise<boolean>;
  prompt(reason: string): Promise<boolean>;
}

export interface ConnectAdapter {
  signPsbt(psbt: Uint8Array): Promise<Uint8Array>;
  signStacksTx(tx: Uint8Array): Promise<Uint8Array>;
  getAvailableWallets(): Promise<WalletApp[]>;
}

export interface PlatformAdapter {
  platform: 'native' | 'web';
  storage: StorageAdapter;
  auth: AuthAdapter;
  connect: ConnectAdapter;
}
```

---

## Core Hook API (unchanged across platforms)

### `SbtcProvider`

```tsx
// Native (Expo) — no polyfill needed in managed SDK setup
import { SbtcProvider } from '@sbtc/sdk';

// Web (Next.js) — identical API
import { SbtcProvider } from '@sbtc/sdk';

export default function RootLayout({ children }) {
  return (
    <SbtcProvider network="mainnet">
      {children}
    </SbtcProvider>
  );
}

// Advanced: override adapter
<SbtcProvider network="mainnet" adapter={myCustomAdapter}>
```

### `useStacksWallet`

```ts
const {
  address,          // STX address
  btcAddress,       // BTC p2wpkh address
  isLoaded,
  generateWallet,
  restoreWallet,    // (mnemonic: string) => Promise<void>
  lockWallet,
  exportMnemonic,   // biometric (native) / WebAuthn (web) gated
  clearWallet,
} = useStacksWallet();
```

### `useSbtcDeposit`

```ts
const { status, txid, deposit, error, reset } = useSbtcDeposit({
  onSuccess: (txid) => {},
  // signPsbt is now OPTIONAL — if omitted, SDK uses the platform adapter's connect
  // Pass your own to override (custom wallet, hardware signer, etc.)
  signPsbt: async (psbt) => signedPsbt, // optional override
});
```

### `useSbtcWithdraw`, `useSbtcBalance`, `useStacksContract`
API identical to before — platform differences are fully abstracted.

---

## Build Milestones

| Milestone | Deliverable | Timeline |
|---|---|---|
| **M1** | Repo setup + adapter interfaces + polyfills + `SbtcProvider` platform detection | Week 1–2 |
| **M2** | `NativeAdapter` (storage, auth, connect) + `useStacksWallet` on native | Week 3–4 |
| **M3** | `WebAdapter` (storage, auth, connect) + `useStacksWallet` on web | Week 5–6 |
| **M4** | Balance hooks + `useNonce` (shared, both platforms) | Week 7 |
| **M5** | `useSbtcDeposit` — PSBT flow on both platforms | Week 8–9 |
| **M6** | `useSbtcWithdraw` — withdrawal flow on both platforms | Week 10–11 |
| **M7** | `useStacksContract` + utils (shared) | Week 12 |
| **M8** | Example apps: Expo + Next.js, both on testnet | Week 13–14 |
| **M9** | Docs site + npm publish | Week 15–16 |

---

## Differentiation vs. Existing Packages

| | `sbtc` (npm) | `@double-spent/sbtc-core` | `@stacks/connect` | **`@sbtc/sdk`** |
|---|---|---|---|---|
| React Native support | ❌ | ❌ | ❌ | ✅ |
| Web / React support | ✅ | ✅ | ✅ | ✅ |
| Unified API (both) | ❌ | ❌ | ❌ | ✅ |
| React hooks | ❌ | ❌ | ❌ | ✅ |
| Polyfills included | ❌ | ❌ | ❌ | ✅ |
| Secure key storage | ❌ | ❌ | ❌ | ✅ |
| Biometric / WebAuthn | ❌ | ❌ | ❌ | ✅ |
| Platform adapter API | ❌ | ❌ | ❌ | ✅ |
| Emily API polling | Partial | ✅ | ❌ | ✅ |

---

## Grant Application Positioning

**Primary track:** Stacks Endowment Builder Grant (up to $50,000)

**Framing:** The Stacks ecosystem has strong web tooling and zero mobile tooling — and no unified SDK that spans both. `@sbtc/sdk` fills both gaps simultaneously with a single package. Built by a Stacks-native developer who hit these tooling gaps firsthand on mobile, then recognized the same friction existed for web developers building with hooks. Mobile is the primary interface for Bitcoin users in Africa and emerging markets; web is the primary interface for DeFi builders. This SDK serves both.
