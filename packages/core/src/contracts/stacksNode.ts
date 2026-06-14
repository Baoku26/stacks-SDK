import { type ClarityValue, deserializeCV, serializeCV } from '@stacks/transactions';
import { SbtcError, SbtcErrorCode } from '../errors';
import { assertHttps, fetchJson } from '../utils/http';
import type { NetworkConfig } from '../utils/network';

/**
 * Generic Stacks-node RPC helpers (nonce, broadcast, read-only call) shared by the
 * contracts hooks and `useSbtcWithdraw`. Internal — NOT barrel-exported.
 *
 * These deliberately live OUTSIDE `sbtc/emily.ts`: that module statically imports
 * the heavy optional `sbtc` peer, so a contracts-only consumer must never reach it
 * (NFR-1.1 / NFR-3.5 — keep `sbtc` out of contract-only bundles). `emily.ts`
 * re-exports `broadcastStacksTx` / `fetchStacksNonce` from here for back-compat.
 */

/** Hiro node account response (nonce only — `?proof=0`). */
export async function fetchStacksNonce(
  apiConfig: NetworkConfig,
  address: string,
  platform?: 'native' | 'web',
): Promise<number> {
  const url = `${apiConfig.hiroApiUrl.replace(/\/$/, '')}/v2/accounts/${address}?proof=0`;
  const account = await fetchJson<{ nonce: number }>(url, { platform });
  return account.nonce;
}

/** Broadcast a signed Stacks transaction (raw bytes) to the Hiro node; returns the Stacks txid. */
export async function broadcastStacksTx(
  apiConfig: NetworkConfig,
  txBytes: Uint8Array,
  platform?: 'native' | 'web',
): Promise<string> {
  const url = `${apiConfig.hiroApiUrl.replace(/\/$/, '')}/v2/transactions`;
  assertHttps(url, platform);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      // Copy into an ArrayBuffer-backed view — `BodyInit` rejects the wide
      // `Uint8Array<ArrayBufferLike>` under the TS 5.7+ lib.
      body: new Uint8Array(txBytes),
    });
  } catch (originalError) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      originalError,
      platform,
      context: { url },
    });
  }
  const text = (await response.text()).trim();
  if (!response.ok) {
    throw new SbtcError({
      code: SbtcErrorCode.TX_SIGNING_FAILED,
      message: text || `Stacks broadcast failed (${response.status}).`,
      platform,
      context: { url, status: response.status },
    });
  }
  // Hiro returns the txid as a JSON-quoted hex string (e.g. `"abcd…"`).
  return text.replace(/^"|"$/g, '');
}

/** Hiro node `call-read-only` response: `okay:true` + serialized `result`, or `okay:false` + `cause`. */
interface ReadOnlyResponse {
  okay: boolean;
  result?: string;
  cause?: string;
}

/**
 * Evaluate a Clarity read-only function on the Hiro node and return the decoded
 * `ClarityValue` (FR-10.1). `contract` is `"<address>.<name>"`; `args` are
 * serialized to hex via `serializeCV`; `sender` is the principal the node treats
 * as `tx-sender`.
 *
 * Error mapping follows the project's fixed-enum gap (MEMORY → [DATA] error-code
 * gap): transport/non-2xx and a Clarity abort (`okay:false`) both surface as
 * `NETWORK_TIMEOUT` (the abort carries `cause` in `context`).
 */
export async function callReadOnly(
  apiConfig: NetworkConfig,
  contract: string,
  fn: string,
  args: ClarityValue[],
  sender: string,
  platform?: 'native' | 'web',
): Promise<ClarityValue> {
  const dot = contract.indexOf('.');
  if (dot === -1) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      message: `Invalid contract id "${contract}" — expected "<address>.<name>".`,
      platform,
      context: { contract },
    });
  }
  const address = contract.slice(0, dot);
  const name = contract.slice(dot + 1);
  const url = `${apiConfig.hiroApiUrl.replace(/\/$/, '')}/v2/contracts/call-read-only/${address}/${name}/${fn}`;
  assertHttps(url, platform);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender, arguments: args.map((a) => serializeCV(a)) }),
    });
  } catch (originalError) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      originalError,
      platform,
      context: { url },
    });
  }
  if (!response.ok) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      platform,
      context: { url, status: response.status },
    });
  }

  let payload: ReadOnlyResponse;
  try {
    payload = (await response.json()) as ReadOnlyResponse;
  } catch (originalError) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      originalError,
      platform,
      context: { url, reason: 'invalid JSON' },
    });
  }

  if (!payload.okay || payload.result === undefined) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      message: payload.cause
        ? `Read-only call aborted: ${payload.cause}`
        : 'Read-only call returned no result.',
      platform,
      context: { url, cause: payload.cause },
    });
  }
  return deserializeCV(payload.result);
}
