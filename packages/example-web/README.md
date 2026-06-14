# `@sbtc/sdk` — Web example (Next.js)

A minimal Next.js (App Router) app that exercises [`@sbtc/sdk`](../core) on the web:

- **Local wallet** — generate / restore / lock / export / clear a self-custodial wallet (`useStacksWallet`). Keys live in encrypted `localStorage`; sensitive actions (export, clear) gate on WebAuthn or a passphrase fallback.
- **Connected wallet** — connect a browser extension (Leather / Xverse) via Stacks Connect to get the funding account + public keys used for deposit / withdraw.
- **Balances** — live testnet sBTC + STX balances (`useSbtcBalance`, `useStxBalance`) for the connected account (or the local wallet).
- **Deposit** — BTC → sBTC (`useSbtcDeposit`), signing the PSBT through the connected extension.
- **Withdraw** — sBTC → BTC (`useSbtcWithdraw`), signing the Stacks `initiate-withdrawal-request` through the connected extension.

Runs against **Stacks testnet** (`SbtcProvider network="testnet"` in `app/providers.tsx`).

## Run it

From the monorepo root:

```bash
pnpm install
pnpm --filter @sbtc/sdk build      # the example consumes the built SDK
pnpm --filter example-web dev      # http://localhost:3000
```

No environment variables are required — testnet API URLs are the SDK defaults. To target a different deployment, pass `apiConfig` to `SbtcProvider` in `app/providers.tsx` (e.g. a live testnet `sbtc-withdrawal` contract — see the SDK's `MEMORY.md` on testnet deployment churn).

## Web setup note

No bundler configuration is required. `@sbtc/sdk`'s web build contains no runtime `import('expo-*')` — the `NativeAdapter`'s native-module loaders are type-only on web — so Turbopack / webpack never traverse into `expo-*` or `react-native`. `next.config.ts` is empty.

> Earlier versions required aliasing the native-only peers (`expo-*`, `react-native`) to an empty module. That step is no longer needed as of the SDK's `react-native` export condition + web-graph-isolation fix.

## Deposit / withdraw flow

1. Click **Connect extension** → approve in Leather / Xverse. The app reads the returned Stacks + p2wpkh Bitcoin accounts (address + public key) from `@stacks/connect`'s `connect()`.
2. Enter an amount (sats) and **Deposit** / **Withdraw**. The hooks build the transaction, hand it to the extension to sign, broadcast it, and poll Emily for confirmation.
3. Watch `status` move through the lifecycle (`building → signing → broadcasting → pending → confirmed`).

> **Testnet funds + an installed extension are required to complete a real deposit/withdraw.** Without them you can still exercise the local-wallet, balances, and wallet-discovery panels, and see the deposit/withdraw flows up to the signing handoff.

## Deploy

The app is a standard Next.js project and deploys to Vercel as-is. Build the SDK first (`pnpm --filter @sbtc/sdk build`) or include it in the monorepo build; the root `turbo` `build` pipeline handles ordering.
