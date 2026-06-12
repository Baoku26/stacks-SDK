# TASKS.md — `@sbtc/sdk`

Source of truth for what gets built and in what order. Update status as you work. Never reorder completed tasks — append new ones at the bottom of each milestone.

**Status legend:**
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[-]` Blocked (add reason inline)
- `[s]` Skipped (add reason inline)

---

## Current Milestone: M1 — Repo Setup + Adapter Interfaces + Polyfills + Provider Detection

**Goal:** The project scaffolding is complete. `SbtcProvider` auto-detects native vs web vs SSR. The polyfill guard fires correctly on native. All three adapter interfaces are defined and typed. No hook logic yet.

**Acceptance criteria:**
- `pnpm build` succeeds
- `pnpm typecheck` passes with zero errors
- `SbtcProvider` mounted in Expo Go renders without error
- `SbtcProvider` mounted in Next.js (SSR + client) renders without error or hydration mismatch
- `SbtcProvider` without polyfills on native throws `POLYFILL_NOT_INITIALIZED`
- All adapter interfaces exported from `src/index.ts`

---

### SETUP

- [x] **T001** — Init pnpm monorepo
  - Root `package.json`, `pnpm-workspace.yaml` pointing to `packages/*`
  - `turbo.json` with `build`, `test`, `lint`, `typecheck`, `size-check` pipeline

- [x] **T002** — Scaffold `packages/core`
  - `tsconfig.json`: strict mode, target ES2020, moduleResolution Node16
  - `package.json`: name `@sbtc/sdk`, version `0.0.1`, peer deps as per PLANNING.md
  - `tsup.config.ts`: dual ESM+CJS, `.d.ts`, separate `polyfills` entry point
  - `package.json` exports field: `.` and `./polyfills`

- [x] **T003** — Scaffold `packages/example-native`
  - `npx create-expo-app@latest example-native --template blank-typescript`
  - Add workspace dep on `@sbtc/sdk`
  - Set up `index.js` entry (polyfill import as first line)

- [x] **T004** — Scaffold `packages/example-web`
  - `npx create-next-app@latest example-web --typescript --app`
  - Add workspace dep on `@sbtc/sdk`

- [x] **T005** — GitHub Actions
  - `ci.yml`: typecheck → lint → test → coverage → size-check
  - `publish.yml`: on version tag → build → `npm publish`

- [x] **T006** — ESLint + Prettier
  - `@typescript-eslint` plugin, no `any` rule on exports
  - No `console.log` rule (only `console.error` with `[sbtc-sdk]` prefix)
  - No direct platform API imports in `wallet/`, `sbtc/`, `contracts/` dirs
  - Prettier: consistent formatting, committed config

- [x] **T007** — `bundlesize` size check step
  - Add `bundlesize` config in `package.json`
  - Web bundle ≤ 60KB gzipped, native polyfills ≤ 80KB gzipped
  - Hook into `pnpm size-check` command

---

### ERRORS

- [x] **T008** — Implement `src/errors.ts`
  - `SbtcErrorCode` enum: all 17 codes from PRD §9.3
  - `SbtcError` class: `code`, `message`, `originalError?`, `context?`, `platform?`
  - Export from `src/index.ts`

---

### POLYFILLS

- [x] **T009** — Implement `src/polyfills/buffer.ts`
  - Sets `global.Buffer` and `global.process`. Idempotent guard.

- [x] **T010** — Implement `src/polyfills/crypto.ts`
  - Imports `react-native-get-random-values`, assigns `@peculiar/webcrypto` to `global.crypto`. Idempotent.

- [x] **T011** — Implement `src/polyfills/streams.ts`
  - Documents Metro alias requirement. Idempotent.

- [x] **T012** — Implement `src/polyfills/index.ts`
  - Imports buffer → crypto → streams in order.
  - On web (`typeof window !== 'undefined'`): early return, no-op.
  - Unit test: after import on simulated native env, all globals defined.

- [ ] **T013** — Write `packages/core/templates/metro.config.js`

---

### ADAPTER INTERFACES + DETECTION

- [ ] **T014** — Implement `src/adapters/types.ts`
  - `StorageAdapter`, `AuthAdapter`, `ConnectAdapter`, `PlatformAdapter` interfaces
  - `WalletApp` type (name, scheme, storeUrl)
  - Export from `src/index.ts`

- [ ] **T015** — Implement `src/adapters/auth-guard.ts`
  - `withAuthGuard<T>(adapter: PlatformAdapter, fn: () => Promise<T>): Promise<T>`
  - Calls `adapter.auth.prompt()` → if returns false → throw `AUTH_FAILED`
  - Export from `src/index.ts`

- [ ] **T016** — Implement `src/adapters/detect.ts`
  - `detectAdapter(): PlatformAdapter`
  - Native: `Platform.OS !== 'web'` → `new NativeAdapter()`
  - Browser: `typeof window !== 'undefined'` → `new WebAdapter()`
  - SSR fallback: `new SsrAdapter()`
  - Unit test: mock each environment, assert correct adapter returned

- [ ] **T017** — Implement `src/adapters/native/index.ts` (stub)
  - `NativeAdapter` class implementing `PlatformAdapter`
  - All methods throw `new Error('NativeAdapter not yet implemented')` for now
  - Mark `platform: 'native'`

- [ ] **T018** — Implement `src/adapters/web/index.ts` (stub)
  - `WebAdapter` class implementing `PlatformAdapter`
  - All methods throw `new Error('WebAdapter not yet implemented')` for now
  - Mark `platform: 'web'`

- [ ] **T019** — Implement `SsrAdapter` (inline in `detect.ts` or own file)
  - Complete no-op. `storage.get` returns null. `auth.prompt` throws `SSR_NOT_SUPPORTED`. `connect.*` throws `SSR_NOT_SUPPORTED`.

---

### PROVIDER
- [ ] **T020** — Implement `src/provider/types.ts`
  - `NetworkMode`, `ApiConfig`, `SbtcProviderProps`, `SbtcContextValue`
  - `SbtcContextValue` includes: `network`, `adapter`, `apiConfig` (resolved URLs)

- [ ] **T021** — Implement `src/provider/context.ts`
  - `createContext<SbtcContextValue | null>(null)`
  - `useSbtcContext()` — throws if called outside provider

- [ ] **T022** — Implement `src/provider/SbtcProvider.tsx`
  - On mount: call `detectAdapter()` unless `adapter` prop provided
  - If native and `global.Buffer` undefined: throw `POLYFILL_NOT_INITIALIZED`
  - Merge `apiConfig` overrides with `MAINNET` / `TESTNET` defaults
  - SSR: skip polyfill check, use `SsrAdapter`
  - Provide context to children

- [ ] **T023** — Write provider unit tests
  - Auto-detects native adapter in simulated RN env
  - Auto-detects web adapter in simulated browser env
  - Uses SSR adapter in simulated server env (no `window`, no `Platform`)
  - Accepts custom `adapter` prop and uses it
  - Throws `POLYFILL_NOT_INITIALIZED` on native without `global.Buffer`
  - No hydration mismatch between SSR and client initial render

---

### BARREL EXPORT

- [ ] **T024** — Wire `src/index.ts`
  - Export all public symbols per PRD §9.1
  - Internal modules (`emily.ts`, `storage.ts`, native/web adapter internals) NOT exported

---

## Milestone M2 — NativeAdapter + useStacksWallet (Native)

**Goal:** Full working wallet on Expo Go. Keys in Secure Enclave. Biometrics gate sensitive actions.

- [ ] **T025** — Implement `src/adapters/native/storage.ts` (expo-secure-store wrapper)
- [ ] **T026** — Implement `src/adapters/native/auth.ts` (expo-local-authentication wrapper)
- [ ] **T027** — Implement `src/adapters/native/connect.ts` (Leather + Xverse deep-links)
- [ ] **T028** — Implement `src/adapters/native/index.ts` (full NativeAdapter)
- [ ] **T029** — Implement `src/wallet/types.ts`
- [ ] **T030** — Implement `src/wallet/useStacksWallet.ts` (platform-agnostic, uses adapter)
- [ ] **T031** — Unit tests: NativeAdapter (mock expo packages)
- [ ] **T032** — Unit tests: useStacksWallet on native (mock NativeAdapter)
- [ ] **T033** — Verify in example-native: generate wallet, show addresses, lock/unlock

---

## Milestone M3 — WebAdapter + useStacksWallet (Web)

**Goal:** Same wallet hook works in Next.js. Encrypted localStorage. WebAuthn auth.

- [ ] **T034** — Implement `src/adapters/web/storage.ts` (localStorage + AES-GCM)
- [ ] **T035** — Implement `src/adapters/web/auth.ts` (WebAuthn + passphrase fallback)
- [ ] **T036** — Implement `src/adapters/web/connect.ts` (@stacks/connect wrapper)
- [ ] **T037** — Implement `src/adapters/web/index.ts` (full WebAdapter)
- [ ] **T038** — Unit tests: WebAdapter (mock localStorage, crypto.subtle, navigator.credentials)
- [ ] **T039** — Unit tests: useStacksWallet on web (mock WebAdapter)
- [ ] **T040** — SSR test: useStacksWallet during server-side render returns safe loading state
- [ ] **T041** — Verify in example-web: generate wallet, show addresses, lock/unlock, Stacks Connect

---

## Milestone M4 — Balance Hooks + Utils (Shared)

**Goal:** `useSbtcBalance`, `useStxBalance`, `useNonce` return live testnet data on both platforms.

- [ ] **T042** — Implement `src/utils/network.ts` (MAINNET / TESTNET constants)
- [ ] **T043** — Implement `src/utils/format.ts` (satsToBtc, btcToSats, formatSats, formatBtc)
- [ ] **T044** — Implement `src/utils/address.ts` (isValidStxAddress, isValidBtcAddress)
- [ ] **T045** — Implement `src/utils/fees.ts` (getFeeEstimate via mempool.space)
- [ ] **T046** — Implement `src/contracts/useStxBalance.ts`
- [ ] **T047** — Implement `src/contracts/useNonce.ts`
- [ ] **T048** — Implement `src/sbtc/useSbtcBalance.ts`
- [ ] **T049** — Unit tests: all utils (100% coverage target)
- [ ] **T050** — Unit tests: balance hooks (mock Hiro API via msw)
- [ ] **T051** — Integration test: correct balances on known funded testnet addresses (both platforms)

---

## Milestone M5 — useSbtcDeposit (Both Platforms)

**Goal:** End-to-end deposit confirmed on testnet — native and web.

- [ ] **T052** — Verify Emily API base URLs (check docs before implementing)
- [ ] **T053** — Implement `src/sbtc/emily.ts` (EmilyClient internal interface + implementation)
- [ ] **T054** — Implement `src/sbtc/types.ts` (DepositStatus, WithdrawalStatus enums)
- [ ] **T055** — Implement `src/sbtc/useSbtcDeposit.ts`
  - Uses `adapter.connect.signPsbt` by default
  - Accepts optional `signPsbt` override
  - Dust limit check (≥ 546 sats)
  - Emily polling with backoff
- [ ] **T056** — Unit tests: useSbtcDeposit (mock Emily, mempool.space, adapter)
- [ ] **T057** — Integration test: deposit flow on testnet — native (Leather deep-link)
- [ ] **T058** — Integration test: deposit flow on testnet — web (Stacks Connect)

---

## Milestone M6 — useSbtcWithdraw (Both Platforms)

**Goal:** End-to-end withdrawal confirmed on testnet — native and web.

- [ ] **T059** — Implement `src/sbtc/useSbtcWithdraw.ts`
  - Uses `adapter.connect.signStacksTx` by default
  - Accepts optional `signTx` override
  - BTC address validation
  - Emily polling for BTC release
  - `estimatedConfirmationMinutes` (static 60)
- [ ] **T060** — Unit tests: useSbtcWithdraw
- [ ] **T061** — Integration test: withdrawal flow on testnet — native
- [ ] **T062** — Integration test: withdrawal flow on testnet — web

---

## Milestone M7 — useStacksContract + Utils Complete

**Goal:** Clarity read-only calls and contract-call builder work on both platforms.

- [ ] **T063** — Implement `src/contracts/useStacksContract.ts`
- [ ] **T064** — Unit tests: useStacksContract (mock Hiro API, mock adapter)
- [ ] **T065** — Integration test: read-only call against known testnet contract
- [ ] **T066** — Integration test: contract call on testnet — native + web
- [ ] **T067** — Run `pnpm size-check` — confirm both bundle size targets met

---

## Milestone M8 — Example Apps

**Goal:** Both example apps run end-to-end on testnet. Both on public GitHub.

- [ ] **T068** — example-native: full deposit/withdraw UI in Expo Go
- [ ] **T069** — example-native: settings screen (network toggle, wipe wallet)
- [ ] **T070** — example-native: README with setup instructions + testnet screenshots
- [ ] **T071** — example-web: full deposit/withdraw UI in Next.js
- [ ] **T072** — example-web: deploy to Vercel (live demo link)
- [ ] **T073** — example-web: README with setup instructions
- [ ] **T074** — Run full manual QA checklist from PRD §12.3 (native)
- [ ] **T075** — Run full manual QA checklist from PRD §12.3 (web)

---

## Milestone M9 — Docs + Publish

**Goal:** `@sbtc/sdk@1.0.0` on npm. Docs live. PR to official Stacks docs.

- [ ] **T076** — Set up Nextra docs site in `/docs`
- [ ] **T077** — `getting-started.mdx` (unified — shows both platforms)
- [ ] **T078** — `platform-adapters.mdx` (how the adapter system works + custom adapter guide)
- [ ] **T079** — `polyfills.mdx` (native-only, most common failure point)
- [ ] **T080** — Hook reference pages (one per hook, 5 pages)
- [ ] **T081** — `provider.mdx` and `security.mdx`
- [ ] **T082** — Example guides: `expo-wallet.mdx`, `nextjs-defi-app.mdx`, `contract-interaction.mdx`
- [ ] **T083** — Deploy docs to Vercel
- [ ] **T084** — Final pre-publish: bundle size, type exports, tree-shaking verification
- [ ] **T085** — Publish `@sbtc/sdk@1.0.0` to npm
- [ ] **T086** — Open PR to `stacks-network/docs` adding SDK to developer tooling page
- [ ] **T087** — Submit Stacks Endowment Builder Grant application

---

## Backlog (v1.1)

- [ ] **B001** — `useStackingPool` — STX stacking delegation hooks
- [ ] **B002** — WalletConnect v2 (web + native)
- [ ] **B003** — `@tanstack/react-query` adapter
- [ ] **B004** — Ledger hardware wallet (WebUSB on web, Bluetooth on native)
- [ ] **B005** — Multi-account HD wallet (account index > 0)
- [ ] **B006** — `@sbtc/sdk-nft` — SIP-009/010 support (separate package)
