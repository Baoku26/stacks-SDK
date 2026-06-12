# MEMORY.md — `@sbtc/sdk`

Decisions made, bugs resolved, patterns established, and platform gotchas. Claude Code reads this at the start of every session. Write here when something non-obvious is discovered, a decision is made after deliberation, or a bug is resolved in a way that could recur.

Format each entry:
```
## [MODULE] Short title
Date: YYYY-MM-DD
Platform: native | web | both | meta
Status: active | superseded | resolved
---
Body
```

---

## [META] Document purpose

Date: 2026-06-11
Platform: meta
Status: active

---

This file accumulates institutional knowledge. It is not a changelog and not a task list. It covers:
1. **Decisions** — when multiple approaches were considered, record the choice and why
2. **Bugs** — when a non-obvious bug was fixed, record root cause so it isn't re-introduced
3. **Gotchas** — when an upstream library, API, or platform behaves unexpectedly
4. **Patterns** — reusable code patterns established for this project

If you encounter a bug or make a non-trivial decision and do NOT write it here, future sessions repeat the same work.

---

## [BUILD] M1 scaffolding decisions (T001–T002)

Date: 2026-06-11
Platform: meta
Status: active

---

Decisions locked while standing up the monorepo and `packages/core`. Recorded so they aren't re-litigated:

- **Turbo 2.x uses `tasks`, not `pipeline`** in `turbo.json`. The 5 tasks: `build` (`dependsOn ^build`, outputs `dist/**`), `typecheck` (`^build`), `lint`, `test`/`test:coverage` (`^build`, outputs `coverage/**`), `size-check` (`dependsOn build` — needs the bundle to measure). Root `pnpm ci` = `turbo run typecheck lint test:coverage size-check`.
- **Core is a no-`"type"` (CommonJS-default) dual package.** `tsconfig` uses `module`/`moduleResolution: Node16` per TASKS T002. Because there is no `"type": "module"`, TS treats `.ts` as CJS under Node16, so extensionless relative imports typecheck fine (no `.js` extensions needed in source). Outputs: `dist/*.js` (CJS) + `dist/*.mjs` (ESM) via tsup; `exports` map exposes `.` and `./polyfills`.
- **`sideEffects`** in `packages/core/package.json` is scoped to the polyfills dist files only — everything else is side-effect-free so web bundlers tree-shake aggressively (bundle-size targets in PLANNING).
- **`@stacks/connect` is an OPTIONAL peer** (marked in `peerDependenciesMeta`). PLANNING's exports code block omits it from the meta but its prose says all web deps are optional — followed the prose so native-only apps aren't forced to install it. Flag if this should change.
- Tooling gotcha that cost real time this session: see the `[BUILD] pnpm 11 config lives in pnpm-workspace.yaml` entry below.

`src/index.ts` and `src/polyfills/index.ts` are currently `export {}` stubs; build/typecheck pass. They get filled by T008 (errors), T012 (polyfills), T024 (barrel).

---

## [BUILD] example-native scaffold (T003)

Date: 2026-06-12
Platform: native
Status: active

---

`packages/example-native` was generated with `create-expo-app --template blank-typescript --no-install` (the `--no-install` matters — see the pnpm/network note below; we install at the workspace root afterward). Generated stack: **Expo SDK ~56, react-native 0.85.3, react 19.2.3, typescript ~6**.

Decisions / notes:
- **blank-typescript, not expo-router.** TASKS T003 specifies `blank-typescript`, so the entry is a classic `index.ts` + `App.tsx` (no `app/` file-based routing). The structure doc (`sbtc-rn-sdk-structure.md`) instead sketches an `app/_layout.tsx` + `app/*.tsx` expo-router layout. **Conflict to resolve at M8 (T068+)** when the real screens are built — decide router then. Followed TASKS for now since it is the source of truth for what to build.
- **Polyfill-first entry lives in `index.ts`** (template default; `main: "index.ts"`), with `import '@sbtc/sdk/polyfills';` as the literal first line. Did not split into a separate `polyfill.js` (the structure doc shows one) — a first-line import in the single entry is sufficient and the polyfill module isn't implemented yet (stub until T009–T012). The SDK's polyfills entry will set the globals itself, so the app entry does NOT manually assign `@peculiar/webcrypto` (unlike the illustrative snippet in [POLYFILLS] import order).
- **React version skew is expected and fine:** example uses React 19; `packages/core` devDeps pin React 18 only for typechecking its own `.tsx`. `react` is a peer of `@sbtc/sdk`, so the example resolves its own React 19. Hooks use stable APIs.
- Removed Expo's generated `CLAUDE.md` / `AGENTS.md` / `.claude/` from the package — they conflict with this repo's single authoritative contract at the root.
- Install succeeded once the pnpm store was primed by earlier (failed) attempts: 454/545 packages reused, ~38s. `@sbtc/sdk` symlinks into the example via `workspace:*`. On a cold store + this sandbox's slow network, expect the first RN/Expo install to be slow or need retries.

---

## [BUILD] example-web scaffold (T004)

Date: 2026-06-12
Platform: web
Status: active

---

`packages/example-web` generated with `create-next-app --typescript --app --use-pnpm --skip-install --yes`. Template chosen by create-next-app: `app-tw` → **Next.js 16.2.9 (App Router), React 19.2.4, Tailwind CSS 4, ESLint 9, TS 5**. Entry config is `next.config.ts`; app dir at package root (no `src/`), matching `sbtc-rn-sdk-structure.md`.

Cleanups applied after generation (create-next-app drops these in automatically):
- Removed the **nested `packages/example-web/pnpm-workspace.yaml`** it created. pnpm only reads the root workspace file; the nested one is dead config. Its `sharp` / `unrs-resolver` build-skip intent was moved into the root `allowBuilds` (see the pnpm 11 config entry) as `false`.
- Removed Expo/Next AI boilerplate (`CLAUDE.md` → just `@AGENTS.md`, plus `AGENTS.md`) — single authoritative contract lives at the repo root.

`@sbtc/sdk: workspace:*` added to dependencies and symlinks to `../../../core`. The app does NOT import the SDK yet — that starts at M3 (WebAdapter + `useStacksWallet` on web, T034+). `tsc --noEmit` on the fresh scaffold is clean. Tailwind 4 is present and fine to use for the demo UI later (premium-minimal aesthetic is a nice-to-have, not required by TASKS).

---

## [BUILD] Lint + format setup (T006)

Date: 2026-06-12
Platform: meta
Status: active

---

**ESLint** is flat-config (ESLint 9 + `typescript-eslint` v8) per package. The SDK config is `packages/core/eslint.config.mjs`; `pnpm --filter @sbtc/sdk lint` runs `eslint src`. Rules: `@typescript-eslint/no-explicit-any: error` (FFI boundaries opt out with an inline `eslint-disable` + reason), `no-console: ['error', { allow: ['error'] }]` (only `console.error('[sbtc-sdk]', …)`), `no-unused-vars` with `^_` escape.

**The adapter rule is machine-enforced**, not just documented. A `files`-scoped override on `src/{wallet,sbtc,contracts}/**` sets:
- `no-restricted-imports` → blocks `expo-secure-store`, `expo-local-authentication`, `@stacks/connect`, and any `**/adapters/native|web` path.
- `no-restricted-globals` → blocks `localStorage`.

Verified with a throwaway probe: importing `expo-secure-store` and referencing `localStorage` inside `src/wallet/` both error with the custom messages. When adding the real hooks (M2+), the way past these is `useSbtcContext().adapter`, never an inline disable. The example apps keep their own lint (`eslint-config-next` for web; none for native) — the SDK config governs `packages/core` only.

**Prettier** config is committed at the root (`.prettierrc`: singleQuote, semi, trailingComma all, printWidth 100). `pnpm format` / `pnpm format:check` at root. The authoritative human docs (`CLAUDE.md`, `MEMORY.md`, `PLANNING.md`, `TASKS.md`, the prd/structure md) are in `.prettierignore` — do NOT run Prettier over them (markdown reflow churns tables/prose). The whole code/config tree is now Prettier-clean (baseline applied, incl. the generated example-web files).

---

## [BUILD] CI + size-check (T005, T007) — and a turbo gotcha

Date: 2026-06-12
Platform: meta
Status: active

---

**Size-check (T007):** uses `bundlesize2` (the maintained fork of the abandoned `bundlesize` — same `bundlesize` package.json config key, same `bundlesize` CLI; classic 0.18 is flaky on Node 24). Config + `size-check` script live in `packages/core/package.json`:
```
"bundlesize": [
  { "path": "./dist/index.mjs",     "maxSize": "60 kB", "compression": "gzip" },
  { "path": "./dist/polyfills.mjs", "maxSize": "80 kB", "compression": "gzip" }
]
```
`index.mjs` = the 60 kB web-bundle budget; `polyfills.mjs` = the 80 kB native-polyfill budget (PRD/PLANNING). The per-platform string-absence assertions described in the tree-shaking memo (web bundle must not contain `expo-secure-store`, etc.) are NOT done by bundlesize — defer until there are real platform bundles to inspect (post-M3).

**Turbo gotcha (cost time):** a task defined in `turbo.json tasks` is scheduled for EVERY package. Packages lacking that script no-op the script itself but STILL run its `dependsOn`. Because `size-check` has `dependsOn: ["build"]` (same-package), `example-web#size-check` (no-op) dragged in `example-web#build` (a full Next build) for nothing. Fix: the root `size-check` script is filtered — `turbo run size-check --filter=@sbtc/sdk`. (typecheck/test use `^build`, not `build`, so they don't trigger sibling app builds — only `size-check` needed filtering.) Because of this, the root `ci` script is chained through the npm scripts (`pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm size-check`) so it inherits the scoped size-check rather than re-globbing.

**CI (T005):** `.github/workflows/ci.yml` (push to main + PRs) runs install → typecheck → lint → test:coverage → size-check. `pnpm/action-setup@v4` takes the pnpm version from `packageManager`; Node 20; pnpm cache. `publish.yml` triggers on `v*` tags → build → `pnpm --filter @sbtc/sdk publish --access public --provenance` using `secrets.NPM_TOKEN`. Verified locally: typecheck/lint/test:coverage/size-check all exit 0 (lint covers core + example-web; example-native has no lint/typecheck script so turbo skips it). Tests are no-ops until a vitest setup lands (M2+), at which point `test:coverage` starts running them automatically.

---

## [ADAPTERS] The adapter rule — hooks never call platform APIs directly

Date: 2026-06-11
Platform: both
Status: active

---

The single most important architectural rule: hooks get the adapter via `useSbtcContext().adapter` and call adapter methods exclusively. No hook imports `expo-secure-store`, `expo-local-authentication`, `localStorage`, or `navigator.credentials` directly.

```ts
// CORRECT
const { adapter } = useSbtcContext();
const value = await adapter.storage.get(WALLET_KEY);

// WRONG — breaks platform-agnosticism, breaks tests, breaks tree-shaking
import * as SecureStore from 'expo-secure-store';
const value = await SecureStore.getItemAsync(WALLET_KEY);
```

This rule makes every hook testable by swapping the adapter mock in context. It also ensures the native adapter code is never bundled in web builds and vice versa.

---

## [ADAPTERS] Platform detection order matters

Date: 2026-06-11
Platform: both
Status: active

---

`detectAdapter()` in `src/adapters/detect.ts` must check in this exact order:

1. React Native check FIRST: `typeof Platform !== 'undefined' && Platform.OS !== 'web'`
2. Browser check SECOND: `typeof window !== 'undefined'`
3. SSR fallback LAST: everything else

**Why this order matters:** Next.js in some configurations exposes `window` as undefined during SSR but also has `global` available. React Native Expo Web (`Platform.OS === 'web'`) runs in a browser context but should use the WebAdapter, not the NativeAdapter. The `Platform.OS !== 'web'` guard prevents Expo Web from accidentally picking up the NativeAdapter.

```ts
export function detectAdapter(): PlatformAdapter {
  // Must be first — RN check before window check
  if (typeof Platform !== 'undefined' && Platform.OS !== 'web') {
    return new NativeAdapter();
  }
  // Browser (including Expo Web)
  if (typeof window !== 'undefined') {
    return new WebAdapter();
  }
  // SSR / server environment
  return new SsrAdapter();
}
```

---

## [ADAPTERS] Tree-shaking native vs web adapter code

Date: 2026-06-11
Platform: both
Status: active

---

The `NativeAdapter` imports `expo-secure-store` and `expo-local-authentication`. The `WebAdapter` imports `localStorage` and `WebAuthn` APIs. These must never appear in the opposing platform's bundle.

**How it works:** `detectAdapter()` uses dynamic import patterns that bundlers can statically analyze for dead code elimination. Metro (RN) will include `NativeAdapter` and tree-shake `WebAdapter`. Webpack/Vite (web) will include `WebAdapter` and tree-shake `NativeAdapter`.

**Verification:** The `pnpm size-check` command (T007) uses `bundlesize` to assert that:
- The web bundle does not contain the string `expo-secure-store`
- The native bundle does not contain the string `navigator.credentials`

Do not remove these assertions — they are the guard against accidental cross-platform bundling.

**If the size-check fails:** Check whether a new import was added to `detect.ts` or `SbtcProvider` that statically references both adapters.

---

## [POLYFILLS] Import order is strict and non-negotiable (native only)

Date: 2026-06-11
Platform: native
Status: active

---

On React Native, `@sbtc/sdk/polyfills` must be the first import in `index.js`. The failure mode is silent: if any module that uses `Buffer` or `crypto` is resolved first, those references capture `undefined` at module init time. The resulting error is not "Buffer is not defined" — it's typically a deeply nested `TypeError` that looks unrelated.

```js
// index.js — CORRECT
import '@sbtc/sdk/polyfills'; // LINE 1, always
import { Crypto } from '@peculiar/webcrypto';
Object.assign(global.crypto, new Crypto());
import 'expo-router/entry';

// WRONG — the expo-router import may resolve @stacks/transactions before polyfills
import 'expo-router/entry';
import '@sbtc/sdk/polyfills'; // too late
```

On web, `@sbtc/sdk/polyfills` is a no-op — the browser already has all these globals. It is safe but unnecessary to import it in web apps.

---

## [POLYFILLS] Polyfill files must be separate modules

Date: 2026-06-11
Platform: native
Status: active

---

`buffer.ts`, `crypto.ts`, `streams.ts` must be separate files imported sequentially in `polyfills/index.ts`. Do not consolidate them.

`@peculiar/webcrypto` depends on `Buffer` being globally set. If both are in the same module, JS module initialization can execute them out of order. Separate files + sequential imports guarantees the load order.

---

## [ADAPTERS / WEB] WebAuthn passphrase fallback is required

Date: 2026-06-11
Platform: web
Status: active

---

WebAuthn is not available in all browser contexts:
- Some in-app browsers (wallet apps, social media webviews) block WebAuthn
- Older browsers (Safari < 15, Firefox < 60)
- HTTP contexts (development without HTTPS)

`WebAdapter.auth` must always have a passphrase fallback. `auth.isAvailable()` returns `true` even if WebAuthn is absent — because the passphrase path covers it.

The SDK does not ship UI. The passphrase fallback calls a configurable `onAuthRequired` callback on `WebAdapter`. If not configured, it uses `window.prompt()` as a last resort (acceptable for development, not production).

```ts
// Consumer-configurable fallback
const webAdapter = new WebAdapter({
  onAuthRequired: async (reason) => {
    // Show your own modal, return the passphrase
    return await myModal.show(reason);
  }
});
<SbtcProvider adapter={webAdapter} network="mainnet" />
```

---

## [ADAPTERS / WEB] localStorage encryption key strategy

Date: 2026-06-11
Platform: web
Status: active

---

The AES-GCM key used to encrypt the mnemonic in `localStorage` must NOT itself be stored in `localStorage` (that would be circular and useless).

**Chosen strategy:** Key is held in memory for the session only. On app reload, user must re-authenticate (WebAuthn or passphrase) to re-derive the key.

**Key derivation:** PBKDF2 from the user's passphrase (or a stable value returned from WebAuthn assertion). The salt is stored in `localStorage` alongside the encrypted mnemonic (the salt is not secret — its purpose is to prevent rainbow table attacks).

```ts
// localStorage entries
'@sbtc_sdk/wallet_v1'       → { iv, ciphertext }   (base64 encoded)
'@sbtc_sdk/wallet_salt_v1'  → salt                  (base64 encoded, not secret)
```

The in-memory AES-GCM key is cleared on `lockWallet()`. On next sensitive action, re-authentication is required to re-derive it.

---

## [ADAPTERS / NATIVE] expo-secure-store 2KB limit

Date: 2026-06-11
Platform: native
Status: active

---

`expo-secure-store` has a 2KB per-value size limit on iOS (Keychain Services constraint). A 24-word BIP39 mnemonic is ~264 bytes. We store only the mnemonic under `@sbtc_sdk/wallet_v1`.

Any non-sensitive wallet metadata (display name, account index preferences, last connected wallet app) goes in a separate `AsyncStorage` entry under `@sbtc_sdk/wallet_meta_v1`. This keeps the secure store entry well under the limit.

---

## [ADAPTERS / NATIVE] expo-secure-store access flags

Date: 2026-06-11
Platform: native
Status: active

---

Use `WHEN_UNLOCKED_THIS_DEVICE_ONLY` for the mnemonic entry:

```ts
await SecureStore.setItemAsync('@sbtc_sdk/wallet_v1', mnemonic, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
```

This means:
- Value only accessible when device is unlocked (biometric or PIN)
- Value does NOT migrate to new devices via iCloud / Google backup
- Value is deleted on app uninstall

Do not use `ALWAYS` or `AFTER_FIRST_UNLOCK` — they weaken the security model. The user should have to unlock their device to access the wallet.

---

## [ADAPTERS / NATIVE] Deep-link callback scheme must be configured by consumer

Date: 2026-06-11
Platform: native
Status: active

---

The NativeAdapter's connect module uses a deep-link callback URL scheme to receive signed PSBTs and transactions back from Leather / Xverse. This scheme must be registered by the consuming app in its `app.json` — the SDK cannot register it.

The SDK's `NativeAdapter` accepts the scheme as a constructor option:
```ts
const nativeAdapter = new NativeAdapter({ callbackScheme: 'myapp' });
// Leather deep-link: leather://psbt?data=...&callback=myapp://psbt-signed
```

If not provided, defaults to `sbtcsdk` — fine for the example app, but consumers must override it.

Document this prominently in the getting-started guide. It's the second most common setup mistake after polyfill import order.

---

## [ADAPTERS / NATIVE] Deep-link schemas to verify before M5

Date: 2026-06-11
Platform: native
Status: needs verification

---

Before implementing `src/adapters/native/connect.ts` (T027), verify current deep-link schemas:

- Leather mobile: check `https://github.com/leather-wallet/mobile` — known schema: `leather://`
- Xverse mobile: check `https://github.com/secretkeylabs/xverse-app` — known schema: `xverse://`

Schemas can change with app updates. Pin to the version-verified schema in a comment. If schema changes, only `connect.ts` needs updating.

---

## [ADAPTERS / WEB] Emily API base URLs to verify before M5

Date: 2026-06-11
Platform: web
Status: needs verification

---

Verify Emily API base URLs before implementing `src/sbtc/emily.ts` (T053):
- Mainnet: likely `https://emily.stacks.co`
- Testnet: likely `https://emily.testnet.stacks.co`

Check `https://docs.stacks.co/sbtc/emily-api` for current URLs. Emily is actively developed.

Endpoint for deposit status: `GET /deposit/{btcTxid}`
Endpoint for withdrawal status: `GET /withdrawal/{stacksTxid}`
Status values: `PENDING → ACCEPTED → CONFIRMED | FAILED`

---

## [WALLET] BTC address derivation from STX private key

Date: 2026-06-11
Platform: both
Status: active

---

`@stacks/wallet-sdk` does not expose a Bitcoin address directly. Must derive it from the same BIP32 path:

```ts
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';

const ECPair = ECPairFactory(ecc);

function deriveBtcAddress(stxPrivateKey: string, network: 'mainnet' | 'testnet'): string {
  const keyPair = ECPair.fromPrivateKey(Buffer.from(stxPrivateKey.replace('01', ''), 'hex'));
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet,
  });
  return address!;
}
```

Note: Stacks private keys are 33 bytes (compressed, with `01` suffix). Strip the suffix before passing to `ECPair.fromPrivateKey`. Add `bitcoinjs-lib`, `ecpair`, and `tiny-secp256k1` to `packages/core/package.json` when implementing T029.

---

## [SBTC] Dust limit for deposits

Date: 2026-06-11
Platform: both
Status: active

---

sBTC deposit contract enforces minimum 546 satoshis. Enforce in `useSbtcDeposit.deposit()` before building PSBT:

```ts
if (amountSats < 546) {
  throw new SbtcError({
    code: SbtcErrorCode.DEPOSIT_BELOW_DUST,
    message: `Deposit amount ${amountSats} sats is below the 546 sat minimum.`,
  });
}
```

---

## [SBTC] Withdrawal confirmation time

Date: 2026-06-11
Platform: both
Status: active

---

Withdrawals require ~6 Bitcoin block confirmations (~60 minutes). `estimatedConfirmationMinutes = 60` is a static value. Do not try to calculate dynamically from mempool data — too complex, out of scope.

Surface this in the hook so UIs can set user expectations. "Your BTC will arrive in approximately 60 minutes" is the correct copy pattern.

---

## [CONTRACTS] Nonce must always be fetched fresh

Date: 2026-06-11
Platform: both
Status: active

---

`useNonce` must always fetch from Hiro API `GET /v2/accounts/{address}` — never cache the nonce. The API returns the pending nonce (confirmed + pending tx count), which is correct for sequential transactions. Caching causes "nonce already used" errors if two transactions are submitted in the same session.

---

## [SSR] Hooks must be safe during server-side render

Date: 2026-06-11
Platform: web
Status: active

---

All hooks check `typeof window === 'undefined'` at the top of their effect and return safe defaults during SSR:

```ts
useEffect(() => {
  if (typeof window === 'undefined') return; // SSR guard
  // ... actual effect
}, []);
```

Return shape during SSR: `{ isLoading: true, data: null, error: null }` — this must match the client's initial render state to prevent React hydration errors. The client then hydrates and runs the actual effects.

Do not use `useLayoutEffect` in any hook — it doesn't run on the server and causes a warning in Next.js.

---

## [BUILD] pnpm 11 config lives in pnpm-workspace.yaml, not .npmrc

Date: 2026-06-11
Platform: meta
Status: active

---

pnpm 11 moved many settings out of `.npmrc` into `pnpm-workspace.yaml` (camelCase keys). Values placed in `.npmrc` for these are silently ignored — `pnpm config get <key>` returns `undefined` and install behaves as if unset.

Two settings this project depends on, both in `pnpm-workspace.yaml`:

```yaml
# @sbtc/sdk's native peers are OPTIONAL — without this, pnpm auto-installs
# react-native + the entire Expo/RN toolchain into the core dev install
# (hundreds of packages; times out on slow networks).
autoInstallPeers: false

# pnpm 11 blocks dependency install scripts by default. tsup→esbuild needs its
# postinstall to fetch the native binary, or `pnpm build` fails.
allowBuilds:
  esbuild: true
```

Symptom when `autoInstallPeers` is wrong: `pnpm install` tries to download `react-native@0.x` / `expo@5x` and fails with ENOTFOUND / timeout, even though nothing in `packages/core` depends on them directly. They are only optional *peers*.

Symptom when a build script is unapproved: install exits non-zero with `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: <pkg>@…`. The decision map is `allowBuilds: { <pkg>: true | false }` — `true` runs the script, `false` explicitly skips it (no warning). pnpm appends `<pkg>: set this to true or false` placeholders here when it hits an undecided script; replace with a real boolean. NOTE: the older `ignoredBuiltDependencies:` list key is NOT read in this pnpm version (11.1.3) — putting names there does nothing; use `allowBuilds`. Current decisions: `esbuild: true` (tsup needs it), `sharp: false` + `unrs-resolver: false` (example-web/Next 16 deps, builds skipped to match create-next-app's own default).

When scaffolding the example apps (T003/T004), they install their own expo/next peers — that is expected and fine; the constraint only applies to the core dev install.

---

## [BUILD] tsup dual output and polyfills entry

Date: 2026-06-11
Platform: both
Status: active

---

Two separate entry points in `tsup.config.ts`:
- `index`: the main SDK export
- `polyfills`: separate side-effect-only entry

This enables `import '@sbtc/sdk/polyfills'` as a standalone import without pulling in the rest of the SDK. Critical for React Native where polyfills must load before everything else.

```ts
// tsup.config.ts
entry: {
  index: 'src/index.ts',
  polyfills: 'src/polyfills/index.ts',
},
```

The `package.json` exports field must expose `./polyfills` as a named condition. See PLANNING.md for the full exports config.

---

## [TESTING] msw for mocking APIs in both environments

Date: 2026-06-11
Platform: both
Status: active

---

Use `msw` (Mock Service Worker) for all API mocking in unit tests. Use `msw/node` adapter (not service worker) for the test environment:

```ts
// test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);

// test/setup.ts
import { server } from './mocks/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` is important — it catches any test that accidentally hits a real API endpoint. Every API call in unit tests must have a corresponding msw handler.

---

## [SECURITY] What counts as sensitive data — never log or surface these

Date: 2026-06-11
Platform: both
Status: active

---

Never include in any log, error message, or external API call:
- BIP39 mnemonic (any form)
- Private key hex (`stxPrivateKey`, `dataPrivateKey`)
- Raw PSBT bytes (may contain key material)
- AES-GCM encryption keys (web)
- WebAuthn credential IDs (correlatable to user identity)
- Raw `expo-secure-store` values

Safe to log/surface:
- STX addresses (`SP...` / `ST...`)
- BTC addresses (`bc1...` / `tb1...`)
- Transaction IDs (Bitcoin txid, Stacks txid)
- Error codes and non-sensitive messages
- Network names, fee amounts, balances
