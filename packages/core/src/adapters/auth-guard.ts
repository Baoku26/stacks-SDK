import { SbtcError, SbtcErrorCode } from '../errors';
import type { PlatformAdapter } from './types';

/**
 * Gates a sensitive operation behind user authentication (PRD SR-3, FR-4.4).
 *
 * Wrap every sensitive action with this: `exportMnemonic`, `clearWallet`,
 * `signPsbt`, `signStacksTx`. It calls `adapter.auth.prompt()` BEFORE running
 * `fn`; if auth is unavailable or the user fails/cancels, `fn` is never called.
 *
 * @param adapter The platform adapter (from `useSbtcContext().adapter`).
 * @param fn      The sensitive operation to run only after successful auth.
 * @param reason  Shown to the user in the auth prompt (e.g. "Export recovery phrase").
 * @throws SbtcError(AUTH_UNAVAILABLE) if no auth mechanism exists.
 * @throws SbtcError(AUTH_FAILED) if the user cancels or authentication fails.
 */
export async function withAuthGuard<T>(
  adapter: PlatformAdapter,
  fn: () => Promise<T>,
  reason = 'Authenticate to continue',
): Promise<T> {
  const available = await adapter.auth.isAvailable();
  if (!available) {
    throw new SbtcError({
      code: SbtcErrorCode.AUTH_UNAVAILABLE,
      platform: adapter.platform,
    });
  }

  const authenticated = await adapter.auth.prompt(reason);
  if (!authenticated) {
    throw new SbtcError({
      code: SbtcErrorCode.AUTH_FAILED,
      platform: adapter.platform,
    });
  }

  return fn();
}
