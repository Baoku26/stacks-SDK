import { base64 } from '@scure/base';
import { SbtcError, SbtcErrorCode } from '../../errors';
import type { StorageAdapter } from '../types';

/**
 * Browser storage backed by `localStorage`, encrypted at rest with AES-GCM via
 * `crypto.subtle` (PLANNING.md → "WebAdapter — Storage"). The 256-bit key is
 * derived with PBKDF2 from a stable, non-sensitive device fingerprint and a
 * per-key random salt; the salt is stored next to the ciphertext (it is not
 * secret — it only defeats precomputation).
 *
 * Why a device fingerprint and not the user passphrase: `useStacksWallet` calls
 * `storage.get()` non-interactively on mount to load addresses, so decryption
 * must not require a prompt. The real protection for SENSITIVE operations is the
 * separate auth gate (`withAuthGuard` → WebAuthn/passphrase), not this layer.
 * (Resolves the MEMORY.md "[ADAPTERS / WEB] localStorage encryption key strategy"
 * vs PLANNING conflict in favour of PLANNING — see MEMORY M3 entry.)
 *
 * All failures are wrapped as `STORAGE_ERROR`. Layout in `localStorage`:
 *   `<key>`        → `base64(iv) + '.' + base64(ciphertext)`
 *   `<key>.salt`   → `base64(salt)`
 */

const PBKDF2_ITERATIONS = 100_000;
const IV_BYTES = 12;
const SALT_BYTES = 16;
const SALT_SUFFIX = '.salt';

/**
 * A stable, non-sensitive browser fingerprint (user agent + screen geometry).
 * Not a real secret — friction against offline attacks on the stored ciphertext.
 */
function deviceFingerprint(): Uint8Array {
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent ?? '') : '';
  const screenInfo =
    typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : '';
  return new TextEncoder().encode(`sbtc-sdk|${ua}|${screenInfo}`);
}

/**
 * Copy bytes into a guaranteed `ArrayBuffer`-backed view. WebCrypto's
 * `BufferSource` rejects `SharedArrayBuffer`-backed `Uint8Array`s under the TS
 * 5.7+ generic typed-array lib, and `@scure/base` returns the wide type.
 */
function ab(data: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(data);
}

/** Session cache of derived keys, keyed by base64(salt), so PBKDF2 runs once per salt. */
const keyCache = new Map<string, CryptoKey>();

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const cacheId = base64.encode(salt);
  const cached = keyCache.get(cacheId);
  if (cached !== undefined) return cached;

  const keyMaterial = await crypto.subtle.importKey('raw', ab(deviceFingerprint()), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: ab(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  keyCache.set(cacheId, key);
  return key;
}

export function createWebStorage(): StorageAdapter {
  return {
    async get(key) {
      try {
        if (typeof localStorage === 'undefined') return null;
        const stored = localStorage.getItem(key);
        if (stored === null) return null;

        const saltB64 = localStorage.getItem(key + SALT_SUFFIX);
        if (saltB64 === null) throw new Error('encrypted value is missing its salt');

        const [ivB64, ctB64] = stored.split('.');
        if (ivB64 === undefined || ctB64 === undefined) {
          throw new Error('malformed ciphertext');
        }

        const cryptoKey = await deriveKey(base64.decode(saltB64));
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: ab(base64.decode(ivB64)) },
          cryptoKey,
          ab(base64.decode(ctB64)),
        );
        return new TextDecoder().decode(plaintext);
      } catch (originalError) {
        throw new SbtcError({
          code: SbtcErrorCode.STORAGE_ERROR,
          originalError,
          platform: 'web',
          context: { key },
        });
      }
    },

    async set(key, value) {
      try {
        // Reuse an existing salt so the cached key stays valid across updates.
        const existingSalt = localStorage.getItem(key + SALT_SUFFIX);
        const salt =
          existingSalt !== null
            ? base64.decode(existingSalt)
            : crypto.getRandomValues(new Uint8Array(SALT_BYTES));

        const cryptoKey = await deriveKey(salt);
        const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          cryptoKey,
          new TextEncoder().encode(value),
        );

        localStorage.setItem(key + SALT_SUFFIX, base64.encode(salt));
        localStorage.setItem(
          key,
          `${base64.encode(iv)}.${base64.encode(new Uint8Array(ciphertext))}`,
        );
      } catch (originalError) {
        throw new SbtcError({
          code: SbtcErrorCode.STORAGE_ERROR,
          originalError,
          platform: 'web',
          context: { key },
        });
      }
    },

    async remove(key) {
      try {
        localStorage.removeItem(key);
        localStorage.removeItem(key + SALT_SUFFIX);
      } catch (originalError) {
        throw new SbtcError({
          code: SbtcErrorCode.STORAGE_ERROR,
          originalError,
          platform: 'web',
          context: { key },
        });
      }
    },
  };
}
