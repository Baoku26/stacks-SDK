/**
 * `@sbtc/sdk/polyfills` — native-only Node shims for React Native (Hermes).
 *
 * Import this as the VERY FIRST line of your native app entry, before anything
 * that may touch `Buffer` / `crypto` (e.g. `@stacks/*`):
 *
 *   // index.js (React Native / Expo)
 *   import '@sbtc/sdk/polyfills';
 *   import 'expo-router/entry'; // or your root component registration
 *
 * On web this is a no-op (FR-2.3): the browser (or the consumer's bundler)
 * already provides these globals, so we skip entirely. The polyfills are applied
 * via exported functions rather than bare side-effect imports specifically so the
 * browser guard below actually prevents the work (a static side-effect import
 * would run regardless of this guard).
 */
import { applyBufferPolyfill } from './buffer';
import { applyCryptoPolyfill } from './crypto';
import { applyStreamsPolyfill } from './streams';

// Browser → no-op. Native (no `window`) and other non-browser runtimes → apply,
// synchronously and in order, so Buffer/crypto exist before any consumer import.
if (typeof window === 'undefined') {
  applyBufferPolyfill();
  applyCryptoPolyfill();
  applyStreamsPolyfill();
}

// Exported for advanced consumers (custom entry sequencing) and for testing.
export { applyBufferPolyfill, applyCryptoPolyfill, applyStreamsPolyfill };
