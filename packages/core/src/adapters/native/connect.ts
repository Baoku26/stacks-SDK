import { base64 } from '@scure/base';
import { SbtcError, SbtcErrorCode } from '../../errors';
import type { ConnectAdapter, WalletApp } from '../types';
import { loadLinking } from './expo';

/**
 * Native wallet connect via deep-links to Leather / Xverse (`expo-linking`,
 * loaded via `loadLinking()` from `./expo`: dynamic on web, static on native —
 * see MEMORY.md → [ADAPTERS] native module loading).
 *
 * PROVISIONAL: the deep-link URL shapes and wallet schemes below are NOT yet
 * verified against the Leather/Xverse mobile apps — confirm before M5
 * (MEMORY.md → [ADAPTERS / NATIVE] Deep-link schemas to verify before M5). The
 * round-trip structure (open URL → await callback on the consumer's registered
 * scheme → decode) is stable; only the exact URLs/params may change, and only
 * this file would need updating.
 */

export interface NativeConnectOptions {
  /**
   * Deep-link callback scheme the consuming app registers in its `app.json`.
   * Defaults to `'sbtcsdk'`; consumers MUST override with their own scheme
   * (MEMORY.md → [ADAPTERS / NATIVE] Deep-link callback scheme).
   */
  callbackScheme?: string;
  /** How long to wait for the wallet to call back before failing. Default 120s. */
  timeoutMs?: number;
}

// UNVERIFIED — see file header. Confirm schemes/store URLs before M5.
const KNOWN_WALLETS: readonly WalletApp[] = [
  { name: 'Leather', scheme: 'leather', storeUrl: 'https://leather.io' },
  { name: 'Xverse', scheme: 'xverse', storeUrl: 'https://www.xverse.app/download' },
];

const DEFAULT_TIMEOUT_MS = 120_000;

export function createNativeConnect(options?: NativeConnectOptions): ConnectAdapter {
  const callbackScheme = options?.callbackScheme ?? 'sbtcsdk';
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  /** Opens `deepLink`, waits for the wallet to return bytes on `${scheme}://${callbackPath}`. */
  async function roundTrip(
    deepLink: string,
    callbackPath: string,
    failCode: SbtcErrorCode,
  ): Promise<Uint8Array> {
    const Linking = await loadLinking();
    const callbackPrefix = `${callbackScheme}://${callbackPath}`;

    return new Promise<Uint8Array>((resolve, reject) => {
      let settled = false;

      // `cleanup` is declared below; the handler/timer reference it inside closures
      // that only run asynchronously (after `cleanup` is initialized), so this is safe.
      const subscription = Linking.addEventListener('url', ({ url }) => {
        // SR-6: only act on the registered callback scheme/host.
        if (!url.startsWith(callbackPrefix)) return;
        cleanup();
        const params = Linking.parse(url).queryParams;
        const data = params?.data;
        if (params?.error !== undefined || typeof data !== 'string') {
          reject(
            new SbtcError({ code: failCode, platform: 'native', context: { reason: 'rejected' } }),
          );
          return;
        }
        try {
          resolve(base64.decode(decodeURIComponent(data)));
        } catch (originalError) {
          reject(new SbtcError({ code: failCode, platform: 'native', originalError }));
        }
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(
          new SbtcError({ code: failCode, platform: 'native', context: { reason: 'timeout' } }),
        );
      }, timeoutMs);

      const cleanup = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subscription.remove();
      };

      Linking.openURL(deepLink).catch((originalError: unknown) => {
        cleanup();
        reject(
          new SbtcError({
            code: SbtcErrorCode.WALLET_CONNECT_UNAVAILABLE,
            platform: 'native',
            originalError,
          }),
        );
      });
    });
  }

  return {
    async signPsbt(psbt) {
      const data = encodeURIComponent(base64.encode(psbt));
      const callback = encodeURIComponent(`${callbackScheme}://psbt-signed`);
      return roundTrip(
        `leather://psbt?data=${data}&callback=${callback}`,
        'psbt-signed',
        SbtcErrorCode.PSBT_SIGNING_FAILED,
      );
    },

    async signStacksTx(tx) {
      const data = encodeURIComponent(base64.encode(tx));
      const callback = encodeURIComponent(`${callbackScheme}://tx-signed`);
      return roundTrip(
        `leather://sign-transaction?data=${data}&callback=${callback}`,
        'tx-signed',
        SbtcErrorCode.TX_SIGNING_FAILED,
      );
    },

    async getAvailableWallets() {
      const Linking = await loadLinking();
      const available: WalletApp[] = [];
      for (const wallet of KNOWN_WALLETS) {
        try {
          if (await Linking.canOpenURL(`${wallet.scheme}://`)) {
            available.push(wallet);
          }
        } catch {
          // canOpenURL throws if the scheme isn't in the iOS LSApplicationQueriesSchemes
          // allowlist; treat as unavailable.
        }
      }
      return available;
    },
  };
}
