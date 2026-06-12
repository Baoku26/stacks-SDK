/**
 * Polyfill: WebCrypto on native (`global.crypto`).
 *
 * Run second by `polyfills/index.ts` (after buffer.ts — `@peculiar/webcrypto`
 * uses `Buffer`). Two pieces, composed deliberately:
 *  - `react-native-get-random-values` installs a NATIVE, secure
 *    `crypto.getRandomValues` (Hermes has none). Side-effect import below.
 *  - `@peculiar/webcrypto` provides `crypto.subtle`, which the above lacks.
 *
 * We KEEP the native `getRandomValues` and add only `subtle`. The @peculiar
 * `Crypto` is instantiated lazily — ONLY when `crypto.subtle` is missing — so it
 * is never constructed in a browser (where its Node-`crypto`-backed `subtle`
 * could throw). Exported as a function so `polyfills/index.ts` runs it only off
 * the browser path. Idempotent (FR-2.2).
 */
import 'react-native-get-random-values';
import { Crypto } from '@peculiar/webcrypto';

/** Minimal writable view of the global crypto slot (avoids lib.dom's readonly `crypto`). */
interface CryptoHost {
  crypto?: { subtle?: unknown; getRandomValues?: unknown };
}

/** Idempotently ensure `global.crypto` has both `getRandomValues` and `subtle`. */
export function applyCryptoPolyfill(): void {
  const host = globalThis as unknown as CryptoHost;

  // Full WebCrypto already present (browser, Node 16+): nothing to do — and do
  // NOT instantiate @peculiar, whose subtle may throw in a browser bundle.
  if (host.crypto !== undefined && host.crypto.subtle !== undefined) {
    return;
  }

  const webcrypto = new Crypto();

  if (host.crypto === undefined) {
    // No crypto at all — install the full @peculiar implementation.
    host.crypto = webcrypto;
  } else {
    // react-native-get-random-values installed getRandomValues but not subtle.
    // Add subtle from @peculiar without disturbing the native getRandomValues.
    Object.defineProperty(host.crypto, 'subtle', {
      value: webcrypto.subtle,
      configurable: true,
      enumerable: true,
    });
  }
}
