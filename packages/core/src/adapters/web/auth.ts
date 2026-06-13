import { base64 } from '@scure/base';
import type { AuthAdapter } from '../types';

/**
 * Browser authentication. Prefers WebAuthn (platform authenticator / passkey)
 * and falls back to a passphrase when WebAuthn is unavailable — older browsers,
 * in-app webviews, or non-secure (HTTP) contexts (MEMORY.md → [ADAPTERS / WEB]
 * WebAuthn passphrase fallback is required).
 *
 * `isAvailable()` is always `true`: the passphrase path covers every context, so
 * `withAuthGuard` never short-circuits to AUTH_UNAVAILABLE on web.
 *
 * The SDK ships no UI. For the passphrase path it calls the consumer-provided
 * `onAuthRequired(reason)`; if none is configured it uses `window.prompt()` as a
 * last resort (acceptable for development, not production).
 *
 * NOTE (MVP): the passphrase is treated as a presence/intent confirmation
 * (non-empty ⇒ pass), not a cryptographic check — storage encryption uses the
 * device fingerprint, not this value (see web/storage.ts). A verified passphrase
 * scheme is out of scope for v1 and the AuthAdapter contract has no channel to
 * return the passphrase to storage.
 */

export interface WebAuthOptions {
  /**
   * Called when WebAuthn is unavailable. Return the passphrase to authenticate,
   * or `null`/empty string to cancel. Wire this to your own modal.
   */
  onAuthRequired?: (reason: string) => Promise<string | null> | string | null;
  /** Relying-party name shown in the WebAuthn prompt. Defaults to `'sbtc-sdk'`. */
  rpName?: string;
}

/** localStorage key holding the registered WebAuthn credential id (base64, non-sensitive). */
const CRED_KEY = '@sbtc_sdk/webauthn_cred_v1';

/** WebAuthn needs a secure context, the API, and a user-verifying platform authenticator. */
async function isWebAuthnAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.isSecureContext) return false;
  if (typeof PublicKeyCredential === 'undefined') return false;
  if (typeof navigator === 'undefined' || navigator.credentials === undefined) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Registers a credential on the first prompt (the create ceremony itself requires
 * user verification), then asserts it on subsequent prompts. Resolves `true` on a
 * verified user, `false` if the authenticator returns nothing.
 */
async function webAuthnPrompt(rpName: string): Promise<boolean> {
  const existing = localStorage.getItem(CRED_KEY);

  if (existing === null) {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: rpName },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'sbtc-wallet',
          displayName: 'Stacks Wallet',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
        authenticatorSelection: { userVerification: 'required' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (credential === null) return false;
    localStorage.setItem(CRED_KEY, base64.encode(new Uint8Array(credential.rawId)));
    return true;
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      // Copy into an ArrayBuffer-backed view — `@scure/base` returns the wide
      // `Uint8Array<ArrayBufferLike>`, which WebAuthn's BufferSource rejects.
      allowCredentials: [{ id: new Uint8Array(base64.decode(existing)), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  return assertion !== null;
}

export function createWebAuth(options?: WebAuthOptions): AuthAdapter {
  const rpName = options?.rpName ?? 'sbtc-sdk';

  return {
    async isAvailable() {
      // Always true — the passphrase fallback covers every browser/context.
      return true;
    },

    async prompt(reason) {
      if (await isWebAuthnAvailable()) {
        try {
          return await webAuthnPrompt(rpName);
        } catch {
          // The user cancelled or verification failed — that is a declined auth,
          // NOT a reason to silently downgrade to the passphrase path.
          return false;
        }
      }

      const provided = options?.onAuthRequired
        ? await options.onAuthRequired(reason)
        : typeof window !== 'undefined' && typeof window.prompt === 'function'
          ? window.prompt(reason)
          : null;
      return typeof provided === 'string' && provided.length > 0;
    },
  };
}
