/**
 * Polyfill: secure `crypto.getRandomValues` on native (`global.crypto`).
 *
 * Run second by `polyfills/index.ts` (after buffer.ts). One piece:
 *  - `react-native-get-random-values` installs a NATIVE, secure
 *    `crypto.getRandomValues` (Hermes has none). Side-effect import below.
 *
 * We deliberately do NOT polyfill `crypto.subtle` on native. The only consumer
 * of `subtle` is the WebAdapter storage (`adapters/web/storage.ts`), which is
 * never bundled on native and runs in a browser where `subtle` is native. The
 * native crypto stack (@scure/@noble, expo-secure-store) needs only
 * `getRandomValues`. The previous `@peculiar/webcrypto` source was Node-
 * `crypto`-backed: it could not even be bundled by Metro (its `node:*` imports
 * fail to resolve on Hermes) and would throw at runtime. See MEMORY.md →
 * [POLYFILLS] crypto.ts — the documented "swap the subtle source" contingency.
 * If a native consumer ever genuinely needs `subtle`, add a Hermes-compatible
 * source (expo-crypto / pure-JS WebCrypto) here — only this file changes.
 *
 * Exported as a function so `polyfills/index.ts` runs it only off the browser
 * path. Idempotent (FR-2.2).
 */
import 'react-native-get-random-values';

/** Idempotently ensure `global.crypto` exposes `getRandomValues`. */
export function applyCryptoPolyfill(): void {
  // `react-native-get-random-values` (imported above for its side effect) has
  // already installed the native, secure `crypto.getRandomValues`. Nothing more
  // to do — `crypto.subtle` is intentionally not polyfilled on native.
}
