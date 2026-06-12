# PLANNING.md — `@sbtc/sdk`

Architecture decisions, adapter design, module dependency graph, and platform trade-offs. The why behind the code.

---

## Architecture Overview

The SDK has three layers:

**1. Protocol layer** — upstream packages do the real work
- `sbtc` — PSBT construction, sBTC deposit helpers
- `@stacks/transactions` — Stacks transaction building, Clarity encoding
- `@stacks/wallet-sdk` — HD wallet derivation, mnemonic generation
- `@stacks/connect` — browser extension wallet popups (web only)

**2. Adapter layer** — isolates all platform-specific behavior
- `PlatformAdapter` interface — the contract
- `NativeAdapter` — React Native / Expo implementation
- `WebAdapter` — browser implementation
- `SsrAdapter` — Next.js server-side no-op
- `detectAdapter()` — selects the right one at runtime

**3. Hook layer** — platform-agnostic React state management
- All hooks call `useSbtcContext().adapter` for any platform operation
- All hooks are identical API surface regardless of platform
- All hooks handle loading states, errors, and polling consistently

The adapter layer is the key insight. It means the hook layer never contains `if (Platform.OS === 'native')` branches. Platform divergence is concentrated in one place and tested independently.

---

## Monorepo Structure

```
packages/
  core/            → @sbtc/sdk (published to npm)
  example-native/  → Expo demo app (consumes core as workspace dep)
  example-web/     → Next.js demo app (consumes core as workspace dep)
```

**Why two example apps instead of one?**
A single example app can't demonstrate both platforms well. Expo and Next.js have different project structures, different polyfill needs, and different wallet connect flows. Two separate apps serve as integration tests for each platform and as reference implementations for consumers. Both consume `@sbtc/sdk` as a workspace package — same import as an external developer would use.

---

## Adapter Design

### Why an adapter interface instead of conditional imports?

**Alternative considered:** Direct conditional imports in hooks.
```ts
// Rejected approach
if (Platform.OS === 'web') {
  const { localStorage } = window;
} else {
  const SecureStore = require('expo-secure-store');
}
```
Problems: Platform logic leaks into every hook. Conditional requires aren't tree-shaken reliably. Testing requires mocking at the module level for every test.

**Chosen approach:** Single `PlatformAdapter` interface, two implementations, auto-detected once in `SbtcProvider`.
Benefits: Hooks have zero platform knowledge. Adapters are independently testable. Consumers can provide custom adapters. Bundle size is controlled — only the matching adapter is included in each platform's build.

### Why three sub-adapters (storage, auth, connect) instead of one flat interface?

Granularity enables custom adapter composition. A consumer with a custom HSM for signing but standard auth can use:
```tsx
<SbtcProvider adapter={{
  platform: 'web',
  storage: new WebAdapter().storage,
  auth: new WebAdapter().auth,
  connect: new MyHsmConnectAdapter(), // custom
}} />
```
A flat interface would force them to reimplement all three concerns.

### SSR Adapter design

The `SsrAdapter` is a complete no-op. Every method is a no-op or returns safe defaults:
```ts
class SsrAdapter implements PlatformAdapter {
  platform = 'web' as const;
  storage = {
    get: async () => null,
    set: async () => {},
    remove: async () => {},
  };
  auth = {
    isAvailable: async () => false,
    prompt: async () => { throw new SbtcError({ code: 'SSR_NOT_SUPPORTED' }); },
  };
  connect = {
    signPsbt: async () => { throw new SbtcError({ code: 'SSR_NOT_SUPPORTED' }); },
    signStacksTx: async () => { throw new SbtcError({ code: 'SSR_NOT_SUPPORTED' }); },
    getAvailableWallets: async () => [],
  };
}
```
Hooks check `typeof window === 'undefined'` as a fast-path before touching the adapter — this prevents even the no-op from being called during SSR.

---

## Module Dependency Graph

```
index.ts (barrel)
    │
    ├── errors.ts                    ← no deps (foundational)
    │
    ├── utils/                       ← no internal deps (pure functions)
    │
    ├── adapters/
    │     ├── types.ts               ← no deps
    │     ├── detect.ts              ← uses: Platform (RN), window check
    │     ├── auth-guard.ts          ← uses: errors.ts
    │     ├── native/                ← uses: expo-secure-store, expo-local-authentication
    │     └── web/                   ← uses: @stacks/connect, Web APIs
    │
    ├── provider/
    │     ├── types.ts               ← uses: adapters/types.ts
    │     └── SbtcProvider.tsx       ← uses: adapters/detect.ts, utils/network.ts
    │
    ├── wallet/
    │     └── useStacksWallet.ts     ← uses: @stacks/wallet-sdk, adapters (via context)
    │
    ├── sbtc/
    │     ├── emily.ts               ← uses: errors.ts (internal only, not exported)
    │     ├── useSbtcBalance.ts      ← uses: provider context (Hiro API URL)
    │     ├── useSbtcDeposit.ts      ← uses: sbtc pkg, emily.ts, adapters (via context)
    │     └── useSbtcWithdraw.ts     ← uses: @stacks/transactions, emily.ts, adapters (via context)
    │
    └── contracts/
          ├── useStacksContract.ts   ← uses: @stacks/transactions, adapters (via context)
          ├── useStxBalance.ts       ← uses: provider context (Hiro API URL)
          └── useNonce.ts            ← uses: provider context (Hiro API URL)
```

**Rules enforced:**
- `utils/` has zero internal deps. Pure functions only.
- `errors.ts` has zero internal deps.
- `adapters/types.ts` has zero internal deps.
- Hooks never import from `adapters/native/` or `adapters/web/` directly — only through context.

---

## Platform-Specific Implementation Details

### NativeAdapter — Storage

`expo-secure-store` with hardware encryption:
```ts
// Writes
await SecureStore.setItemAsync(key, value, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

// Reads — no explicit decryption needed, device unlock is the gate
const value = await SecureStore.getItemAsync(key);
```

`WHEN_UNLOCKED_THIS_DEVICE_ONLY` means:
- Value is only accessible when the device is unlocked
- Value does not migrate to new devices via iCloud backup
- Value is deleted when the app is uninstalled

Size limit: 2KB per entry. Mnemonic (~264 bytes) is well within this.

### WebAdapter — Storage

`localStorage` with AES-GCM encryption via `crypto.subtle`:
```ts
// Key derivation (PBKDF2 from a device fingerprint)
const keyMaterial = await crypto.subtle.importKey('raw', fingerprint, 'PBKDF2', false, ['deriveKey']);
const encryptionKey = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
);

// Encryption
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, data);
// Store: base64(iv) + '.' + base64(encrypted)
```

**Device fingerprint source:** A stable, non-sensitive identifier derived from browser characteristics (user agent + screen resolution hash). Not a perfect security measure, but adds friction against offline attacks on the stored ciphertext. The real security guarantee comes from the WebAuthn credential required to unlock it.

**Key persistence strategy:** The derived AES-GCM key is held in memory for the session. On reload, it is re-derived. This means: if a user clears `sessionStorage` mid-session, they must re-authenticate. Acceptable trade-off.

### WebAdapter — Auth

WebAuthn flow:
```ts
// Registration (first wallet creation)
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: 'sbtc-sdk' },
    user: { id: walletId, name: address, displayName: 'Stacks Wallet' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
    authenticatorSelection: { userVerification: 'required' },
  }
});

// Authentication (subsequent sensitive actions)
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [{ id: credentialId, type: 'public-key' }],
    userVerification: 'required',
  }
});
```

Passphrase fallback when WebAuthn unavailable: a `window.prompt()` (acceptable for MVP) or a modal dialog in the example app. The SDK does not ship UI — the `auth.prompt()` method in the fallback path calls a configurable `onAuthRequired` callback.

### WebAdapter — Connect

Uses `@stacks/connect` which handles the browser extension detection and popup:
```ts
// PSBT signing
openPsbtRequestPopup({
  hex: toHex(psbt),
  onFinish: (data) => resolve(fromHex(data.hex)),
  onCancel: () => reject(new SbtcError({ code: 'PSBT_SIGNING_FAILED' })),
});

// Contract call
openContractCall({
  contractAddress,
  contractName,
  functionName,
  functionArgs,
  onFinish: (data) => resolve(data.txid),
  onCancel: () => reject(new SbtcError({ code: 'TX_SIGNING_FAILED' })),
});
```

### NativeAdapter — Connect

Deep-link flow for Leather mobile:
```ts
const psbtBase64 = Buffer.from(psbt).toString('base64');
const callbackScheme = 'sbtcsdk'; // app must register this in app.json
const deepLink = `leather://psbt?data=${encodeURIComponent(psbtBase64)}&callback=${callbackScheme}://psbt-signed`;

await Linking.openURL(deepLink);

// Listen for callback
const subscription = Linking.addEventListener('url', ({ url }) => {
  if (url.startsWith(`${callbackScheme}://psbt-signed`)) {
    const params = new URL(url).searchParams;
    const signedPsbt = Buffer.from(params.get('data')!, 'base64');
    subscription.remove();
    resolve(signedPsbt);
  }
});
```

---

## Build Architecture

### tsup Configuration

```ts
// tsup.config.ts
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    polyfills: 'src/polyfills/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'react', 'react-native',
    'expo-secure-store', 'expo-local-authentication',  // native peer deps
    '@stacks/connect',                                  // web peer dep
  ],
  // platform: 'neutral' — let consumers' bundlers tree-shake
});
```

### package.json exports

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./polyfills": {
      "import": "./dist/polyfills.mjs",
      "require": "./dist/polyfills.js"
    }
  },
  "peerDependencies": {
    "react": ">=18",
    "react-native": ">=0.73",
    "expo-secure-store": ">=13",
    "expo-local-authentication": ">=14",
    "@stacks/connect": ">=7"
  },
  "peerDependenciesMeta": {
    "react-native": { "optional": true },
    "expo-secure-store": { "optional": true },
    "expo-local-authentication": { "optional": true }
  }
}
```

All native deps are `optional` peer deps — web projects don't install them. All web deps are optional too — native projects don't install `@stacks/connect`.

### Bundle Size Targets

| Build | Target |
|---|---|
| Web bundle (no native deps) | ≤ 60KB gzipped |
| Native bundle (no web deps) | ≤ 80KB gzipped (excl. polyfills) |
| Native polyfill bundle | ≤ 80KB gzipped |

CI step `pnpm size-check` uses `bundlesize` to assert these limits on every PR.

---

## Versioning

- SemVer strictly.
- v1.0.0 = all M1–M9 milestones complete, both example apps running on testnet, manual QA checklist passed on both platforms.
- npm scope: `@sbtc/sdk` — coordinate with Stacks Foundation for scope access. Fallback: `@dml/sbtc-sdk`.
- Changelog: Keep a Changelog format in `CHANGELOG.md`.

---

## What We Deliberately Don't Own

- **Signing UX** — the `signPsbt` and `signStacksTx` overrides on hooks let consumers bypass the adapter entirely for custom flows. We provide working defaults, not mandates.
- **WebAuthn registration UI** — the SDK provides the WebAuthn calls but not the UI to trigger them. The example app shows the pattern; consumers implement their own.
- **Deep-link URL scheme** — consumers register their own scheme in `app.json`. The SDK provides the URI builders; the scheme name is configurable.
- **Transaction retry** — if broadcast fails, the hook moves to `failed`. `reset()` + retry is the consumer's choice.
- **Fee selection** — `getFeeEstimate()` returns `{ low, medium, high }`. Consumer picks.
