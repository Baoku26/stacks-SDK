import { SbtcError, SbtcErrorCode } from '../errors';

/**
 * Internal HTTPS-only JSON fetch helper shared by `utils/fees` and the balance /
 * nonce hooks. NOT barrel-exported. Imports only `errors` (a leaf), so `utils/`
 * stays free of adapter/provider/hook deps.
 *
 * Error mapping, given the fixed `SbtcErrorCode` enum (PRD §9.3 has no generic
 * "API error" code — see MEMORY.md → [DATA] error-code gap):
 *   - non-HTTPS URL                         → NETWORK_SECURITY_ERROR (SR-8)
 *   - timeout / fetch rejection / non-2xx   → NETWORK_TIMEOUT (carries `status` in context)
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/** Throws NETWORK_SECURITY_ERROR unless `url` is HTTPS (SR-8). */
export function assertHttps(url: string, platform?: 'native' | 'web'): void {
  if (!url.startsWith('https://')) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_SECURITY_ERROR,
      platform,
      context: { url },
    });
  }
}

export async function fetchJson<T>(
  url: string,
  options?: { timeoutMs?: number; platform?: 'native' | 'web' },
): Promise<T> {
  const platform = options?.platform;
  assertHttps(url, platform);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (originalError) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      originalError,
      platform,
      context: { url },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      platform,
      context: { url, status: response.status },
    });
  }

  try {
    return (await response.json()) as T;
  } catch (originalError) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      originalError,
      platform,
      context: { url, reason: 'invalid JSON' },
    });
  }
}
