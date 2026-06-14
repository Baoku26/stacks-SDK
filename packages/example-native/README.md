# `@baoku26/sbtc-sdk` — Native example (Expo)

A blank-TypeScript Expo app that exercises [`@baoku26/sbtc-sdk`](../core) on React Native, with four tabs:

- **Wallet** — generate / lock / export / clear a self-custodial wallet (`useStacksWallet`). Keys live in the device Secure Enclave (`expo-secure-store`); export / clear gate on biometrics (`expo-local-authentication`). Plus live testnet sBTC + STX balances.
- **Deposit** — BTC → sBTC (`useSbtcDeposit`).
- **Withdraw** — sBTC → BTC (`useSbtcWithdraw`).
- **Settings** — network toggle, wallet discovery (Leather / Xverse deep-link detection), and wipe-wallet.

Runs against **Stacks testnet** by default.

## Run it

From the monorepo root:

```bash
pnpm install
pnpm --filter @baoku26/sbtc-sdk build      # the example consumes the built SDK
pnpm --filter example-native start # then press i / a, or scan the QR in Expo Go
```

The three native peers are already installed (`expo-secure-store`, `expo-local-authentication`, `expo-linking`). If you copy this app out of the monorepo, reinstall them with `npx expo install …` so versions match your Expo SDK.

## Two setup pieces the SDK requires on native

1. **Polyfills first.** `index.ts` has `import '@baoku26/sbtc-sdk/polyfills';` as its **first line** — before anything that touches `Buffer` / `crypto`. The failure mode otherwise is a silent, unrelated-looking crash.
2. **Metro `stream` alias.** `metro.config.js` aliases Node's `stream` → `readable-stream` (transitive `@stacks` / `@scure` deps need it on Hermes).

The deep-link callback scheme is set in two matching places: `app.json` (`"scheme": "sbtcsdk"`) and `App.tsx` (`new NativeAdapter({ callbackScheme: 'sbtcsdk' })`).

## Native deposit / withdraw: account is fully auto-derived; signing caveat

The sBTC deposit/withdraw hooks need the funding account's **public key** (`paymentPublicKey` / `stacksPublicKey`). `useStacksWallet` now exposes `publicKey` (compressed secp256k1, account 0), so the Deposit/Withdraw screens populate the account **entirely from the local wallet** — no manual paste.

The remaining v1 caveat is **signing**, not the account: deposit/withdraw default to `adapter.connect.sign*`, which deep-links to Leather/Xverse mobile (a scheme that is **PROVISIONAL/unverified in v1** — see the SDK's `MEMORY.md`) and signs with the *external* wallet's key. To complete a deposit funded by the *local* wallet you'd pass a `signPsbt` / `signTx` override that signs with the local key (local signing is not part of v1). So these screens demonstrate full hook wiring up to the signing handoff.

## Verifying on a device (manual)

End-to-end testnet flows need Expo Go (or a dev build) plus funded testnet sBTC/BTC and a wallet app — they are not automated here (PRD §12.3 manual QA, T074). Checklist:

- [ ] Generate wallet → valid `ST…` / `tb1q…` addresses
- [ ] Lock → addresses clear; Export → biometric prompt fires
- [ ] Balances load for the generated address
- [ ] Deposit / Withdraw build → sign (deep-link) → status advances
- [ ] No keys printed in Metro logs at any point

Add screenshots to `./assets/` and link them here once captured on a device.
