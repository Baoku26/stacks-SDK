# CLAUDE.md — `@sbtc/sdk`

Primary context document for Claude Code. Read fully at the start of every session before touching any code.

---

## Project Identity

**Package:** `@sbtc/sdk`
**Purpose:** Universal React SDK for sBTC and Stacks — works on React Native / Expo and React (web) from a single install. Platform differences handled via a pluggable adapter system.
**Status:** Active development — v1.0.0 in progress. Milestone **M1 (scaffolding)** underway: monorepo root + `packages/core` scaffold build cleanly. See `TASKS.md` for the live task state (source of truth).
**Repo layout:** pnpm monorepo + Turborepo. Three packages: `packages/core` (SDK), `packages/example-native` (Expo demo), `packages/example-web` (Next.js demo).

---

## Authoritative Documents

Read before making any architectural decision. Do not contradict them without flagging the conflict explicitly.

| File | Purpose |
|---|---|
| `PRD.md` | Full product requirements, FR/NFR numbers, API spec, error codes |
| `PLANNING.md` | Architecture decisions, adapter design, module dependency graph, platform trade-offs |
| `TASKS.md` | Current milestone, task status — source of truth for what to build next |
| `MEMORY.md` | Decisions made, bugs resolved, patterns established — check before solving any problem |

---

## Codebase Map

```
packages/core/src/
├── index.ts                  ← public API barrel — only export what's in PRD §9.1
├── errors.ts                 ← SbtcError class + SbtcErrorCode enum (all 17 codes)
├── polyfills/                ← NATIVE ONLY. No-op on web. Must be first import in RN entry.
├── adapters/
│   ├── types.ts              ← PlatformAdapter, StorageAdapter, AuthAdapter, ConnectAdapter
│   ├── detect.ts             ← auto-detects platform → returns correct adapter instance
│   ├── auth-guard.ts         ← withAuthGuard(fn) — calls adapter.auth.prompt() before fn
│   ├── native/               ← NativeAdapter: expo-secure-store, expo-local-auth, deep-links
│   │   ├── index.ts
│   │   ├── storage.ts
│   │   ├── auth.ts
│   │   └── connect.ts
│   └── web/                  ← WebAdapter: localStorage+AES-GCM, WebAuthn, @stacks/connect
│       ├── index.ts
│       ├── storage.ts
│       ├── auth.ts
│       └── connect.ts
├── provider/                 ← SbtcProvider + useSbtcContext
├── wallet/                   ← useStacksWallet (platform-agnostic, uses adapter)
├── sbtc/                     ← useSbtcDeposit, useSbtcWithdraw, useSbtcBalance, emily client
├── contracts/                ← useStacksContract, useStxBalance, useNonce
└── utils/                    ← format, address, fees, network constants (pure, no deps)
```

---

## The Adapter Rule

**Hooks never call platform APIs directly.** Every platform-specific operation goes through the adapter:

```ts
// CORRECT — hook uses adapter
const { storage, auth, connect } = useSbtcContext().adapter;
await withAuthGuard(() => storage.remove(WALLET_KEY));

// WRONG — hook calls platform API directly
import * as SecureStore from 'expo-secure-store'; // never in hooks
```

The adapter instance lives on the context. Hooks get it via `useSbtcContext().adapter`. This is the single most important architectural rule — it's what makes the hooks platform-agnostic.

---

## Coding Rules

### TypeScript
- Strict mode on. No `any` in exported interfaces.
- All public hook return types explicitly declared, not inferred.
- Use `unknown` for `originalError` fields.
- Enums for all status strings. No raw string literals in logic branches.

### Hooks
- Every hook returns: `{ data?, isLoading, error, ...actions }`.
- Side-effect-free on import. Effects only inside `useEffect`.
- Never throw from a hook. Return errors via the `error` field.
- Always clean up polling intervals on unmount.
- During SSR (`typeof window === 'undefined'`): return `{ isLoading: true, data: null, error: null }` immediately. No storage, auth, or network calls.

### Error Handling
- All errors extend `SbtcError` from `src/errors.ts`.
- Every error has a `code` from `SbtcErrorCode` enum (PRD §9.3).
- Include `platform: 'native' | 'web'` on errors originating from adapters.
- Log pattern: `console.error('[sbtc-sdk]', error.code, error.message)` — nothing else.
- Never include key material, mnemonics, or private hex in any error or log.

### Security (non-negotiable)
- Private keys in memory only. Never written to disk in any form other than through the storage adapter's encryption.
- `withAuthGuard` must wrap every sensitive operation: `exportMnemonic`, `clearWallet`, `signPsbt`, `signStacksTx`.
- HTTPS only. Throw `NETWORK_SECURITY_ERROR` on any HTTP endpoint.
- SSR adapter is a complete no-op — zero storage, zero auth, zero network.

### Bundle Size
- `NativeAdapter` must not be bundled in web builds.
- `WebAdapter` must not be bundled in native builds.
- Verify with `pnpm size-check` before any release.

---

## Commands

```bash
# Install
pnpm install

# Build core SDK
pnpm --filter @sbtc/sdk build

# Unit tests
pnpm --filter @sbtc/sdk test

# Unit tests with coverage
pnpm --filter @sbtc/sdk test:coverage

# Integration tests (requires funded testnet wallet env vars)
pnpm --filter @sbtc/sdk test:integration

# Lint
pnpm --filter @sbtc/sdk lint

# Type check
pnpm --filter @sbtc/sdk typecheck

# Bundle size check
pnpm --filter @sbtc/sdk size-check

# Start native example app
pnpm --filter example-native start

# Start web example app
pnpm --filter example-web dev

# Run all CI checks locally
pnpm ci
```

**Install note (pnpm 11):** workspace settings live in `pnpm-workspace.yaml`, not `.npmrc` (camelCase keys; `.npmrc` values for these are silently ignored). Two are load-bearing: `autoInstallPeers: false` (the native peers are optional — otherwise `pnpm install` drags in the whole Expo/RN toolchain) and `allowBuilds: { esbuild: true }` (tsup's esbuild postinstall is blocked by default). See `MEMORY.md` → `[BUILD] pnpm 11 config`.

---

## Key External APIs

### Hiro API (Stacks)
- Mainnet: `https://api.hiro.so`
- Testnet: `https://api.testnet.hiro.so`
- STX balance + nonce: `GET /v2/accounts/{address}`
- Broadcast tx: `POST /v2/transactions`
- sBTC balance: `GET /v1/tokens/ft/balances?principal={address}`

### Emily API (sBTC bridge)
- Mainnet: `https://emily.stacks.co` ← verify before M5
- Testnet: `https://emily.testnet.stacks.co` ← verify before M5
- Deposit status: `GET /deposit/{btcTxid}`
- Withdrawal status: `GET /withdrawal/{stacksTxid}`
- Status values: `PENDING → ACCEPTED → CONFIRMED | FAILED`

### Mempool.space (Bitcoin)
- Mainnet: `https://mempool.space/api`
- Testnet: `https://mempool.space/testnet/api`
- Fee rates: `GET /v1/fees/recommended`
- UTXOs: `GET /address/{btcAddress}/utxo`
- Broadcast: `POST /tx`

---

## What Claude Should NOT Do

- Do not call `expo-secure-store`, `expo-local-authentication`, `localStorage`, or `WebAuthn` directly from hook files — use the adapter.
- Do not add platform detection (`Platform.OS`, `typeof window`) anywhere except `src/adapters/detect.ts` and `SbtcProvider`.
- Do not export internal modules. Only barrel-export what's in PRD §9.1.
- Do not implement v1.1 features: stacking, WalletConnect v2, multi-account, NFTs.
- Do not add UI components. This SDK has no UI.
- Do not swallow errors silently. Every caught error must be returned via hook `error` field or re-thrown as `SbtcError`.
- Do not write polyfill code outside `src/polyfills/`.
- Do not perform any wallet/storage/auth operation during SSR — check `typeof window` and return early.

---

## Session Start Checklist

1. Read `TASKS.md` — find the current active task
2. Read the relevant section of `MEMORY.md` for the module being worked on
3. Read the relevant FR numbers from `PRD.md` for the feature being implemented
4. Read the relevant section of `PLANNING.md` for architectural constraints
5. Run `pnpm typecheck` — confirm the codebase is clean before starting
