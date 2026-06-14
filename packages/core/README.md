# @baoku26/sbtc-sdk

**Universal React SDK for sBTC and Stacks.** One install, one API — works on **React Native / Expo** and **React (web)**. Platform differences (secure storage, biometric auth, wallet connection) are handled by a pluggable adapter system, so your hooks stay platform-agnostic.

```bash
npm install @baoku26/sbtc-sdk
```

## Features

- **One API, both platforms** — the same hooks run on native and web; the SDK auto-detects the platform and wires the right adapter.
- **No web bundler config** — the web build contains no `expo-*` / `react-native` references, so there's nothing to alias.
- **Native-ready** — ships polyfills and a Metro config for React Native (Hermes); keys live in the device secure enclave.
- **Self-custodial wallet** — generate / restore / lock / export, biometric- or WebAuthn-gated.
- **sBTC bridge** — deposit (BTC → sBTC) and withdraw (sBTC → BTC) with Emily status polling.
- **Contracts & balances** — read-only calls, contract calls, sBTC / STX balances, nonce.
- **Typed & tree-shakeable** — strict TypeScript, explicit hook return types, per-platform builds.

## Quick start

```tsx
import { SbtcProvider, useStacksWallet } from '@baoku26/sbtc-sdk';

function App() {
  return (
    <SbtcProvider network="testnet">
      <Wallet />
    </SbtcProvider>
  );
}

function Wallet() {
  const { address, btcAddress, generateWallet, error } = useStacksWallet();
  if (address) return <p>{address} · {btcAddress}</p>;
  return (
    <>
      <button onClick={generateWallet}>Generate wallet</button>
      {error && <p>{error.code}: {error.message}</p>}
    </>
  );
}
```

### React Native: two setup steps

1. Import the polyfills as the **first line** of your entry file:
   ```ts
   import '@baoku26/sbtc-sdk/polyfills'; // before anything that touches Buffer / crypto
   ```
2. Alias Node's `stream` in `metro.config.js` (a ready-to-copy file ships at `@baoku26/sbtc-sdk/templates/metro.config.js`).

On **web** there's no extra setup.

## Hooks

| Hook | Purpose |
| --- | --- |
| `useStacksWallet` | Self-custodial HD wallet (generate / restore / lock / export / clear) |
| `useSbtcDeposit` | BTC → sBTC |
| `useSbtcWithdraw` | sBTC → BTC |
| `useSbtcBalance` / `useStxBalance` | Live balances |
| `useStacksContract` / `useNonce` | Read-only queries, contract calls, nonce |

## Platforms

| Platform | Storage | Auth | Wallet connect |
| --- | --- | --- | --- |
| React Native / Expo | `expo-secure-store` | `expo-local-authentication` | Leather / Xverse deep links |
| React (web) | `localStorage` + AES-GCM | WebAuthn | `@stacks/connect` |
| SSR | no-op | no-op | no-op |

## Documentation

Full guides and the complete hook reference are in [`/docs`](https://github.com/Baoku26/stacks-SDK/tree/main/docs) — Getting Started, Polyfills, Platform Adapters, Provider, Security, and per-hook pages.

## License

MIT
