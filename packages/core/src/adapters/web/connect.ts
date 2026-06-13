import { hex } from '@scure/base';
import { serializeTransaction } from '@stacks/transactions';
import { SbtcError, SbtcErrorCode } from '../../errors';
import type { ConnectAdapter, WalletApp } from '../types';

/**
 * Browser wallet connect via `@stacks/connect` (Leather / Xverse extension
 * popups). `@stacks/connect` is loaded with a dynamic `import()` so it never
 * enters the static module graph — that is what keeps it out of native bundles
 * (`detect.ts` references this adapter; MEMORY.md → [ADAPTERS] tree-shaking).
 *
 * Bytes in / bytes out per the {@link ConnectAdapter} contract: PSBTs and Stacks
 * transactions cross the boundary as hex, decoded back to `Uint8Array` here.
 */

// Store URLs are install-guidance only; align with the native KNOWN_WALLETS list.
const KNOWN_WALLETS: readonly WalletApp[] = [
  { name: 'Leather', scheme: 'leather', storeUrl: 'https://leather.io' },
  { name: 'Xverse', scheme: 'xverse', storeUrl: 'https://www.xverse.app/download' },
];

export function createWebConnect(): ConnectAdapter {
  return {
    async signPsbt(psbt) {
      const connect = await import('@stacks/connect');
      return new Promise<Uint8Array>((resolve, reject) => {
        connect.openPsbtRequestPopup({
          hex: hex.encode(psbt),
          onFinish: (data) => {
            try {
              resolve(hex.decode(data.hex));
            } catch (originalError) {
              reject(
                new SbtcError({
                  code: SbtcErrorCode.PSBT_SIGNING_FAILED,
                  platform: 'web',
                  originalError,
                }),
              );
            }
          },
          onCancel: () =>
            reject(
              new SbtcError({
                code: SbtcErrorCode.PSBT_SIGNING_FAILED,
                platform: 'web',
                context: { reason: 'cancelled' },
              }),
            ),
        });
      });
    },

    async signStacksTx(tx) {
      const connect = await import('@stacks/connect');
      return new Promise<Uint8Array>((resolve, reject) => {
        connect.openSignTransaction({
          txHex: hex.encode(tx),
          onFinish: (data) => {
            try {
              resolve(hex.decode(serializeTransaction(data.stacksTransaction)));
            } catch (originalError) {
              reject(
                new SbtcError({
                  code: SbtcErrorCode.TX_SIGNING_FAILED,
                  platform: 'web',
                  originalError,
                }),
              );
            }
          },
          onCancel: () =>
            reject(
              new SbtcError({
                code: SbtcErrorCode.TX_SIGNING_FAILED,
                platform: 'web',
                context: { reason: 'cancelled' },
              }),
            ),
        });
      });
    },

    async getAvailableWallets() {
      // Browser extensions inject their providers at runtime and `@stacks/connect`
      // renders its own picker; we can't enumerate installed extensions without a
      // popup, so advertise the supported set for "install this wallet" guidance.
      return [...KNOWN_WALLETS];
    },
  };
}
