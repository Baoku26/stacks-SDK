import {
  SbtcApiClientMainnet,
  SbtcApiClientTestnet,
  MAINNET as SBTC_MAINNET,
  TESTNET as SBTC_TESTNET,
  type SbtcApiClient,
  type BitcoinNetwork,
} from 'sbtc';
import { SbtcError, SbtcErrorCode } from '../errors';
import { assertHttps, fetchJson } from '../utils/http';
import type { NetworkConfig } from '../utils/network';

/**
 * Internal glue to the official `sbtc` package (an optional peer dep — see
 * package.json / NFR-1.1, excluded from the bundle budget). NOT barrel-exported.
 *
 * `sbtc` is statically imported here (pure JS — `@scure`/`@stacks`/`@noble`, no
 * react-native), so it only enters a build that imports a deposit/withdraw hook
 * (tree-shaken otherwise — NFR-3.5).
 *
 * VERSION NOTE: `sbtc@0.3` bundles `@scure/btc-signer@1.x` while this SDK uses
 * `@2.x`, so `btc.Transaction` instances are NOT interchangeable across the
 * boundary. We therefore never hand a v2 `Transaction` to the client: we broadcast
 * the raw tx ourselves (`broadcastRawTx`) and notify Emily with the hex-string
 * overload of `notifySbtc`. The client is used only for non-Transaction calls
 * (signer key, UTXOs, fee rate, deposit status).
 */

/** Build the network-appropriate `sbtc` client (keeps the package's `sbtcContract` default), enforcing HTTPS (SR-8). */
export function createSbtcApiClient(
  apiConfig: NetworkConfig,
  network: 'mainnet' | 'testnet',
  platform?: 'native' | 'web',
): SbtcApiClient {
  assertHttps(apiConfig.emilyApiUrl, platform);
  assertHttps(apiConfig.bitcoinApiUrl, platform);
  assertHttps(apiConfig.hiroApiUrl, platform);
  const overrides = {
    sbtcApiUrl: apiConfig.emilyApiUrl,
    btcApiUrl: apiConfig.bitcoinApiUrl,
    stxApiUrl: apiConfig.hiroApiUrl,
  };
  return network === 'mainnet'
    ? new SbtcApiClientMainnet(overrides)
    : new SbtcApiClientTestnet(overrides);
}

/** The `@scure/btc-signer` network object `sbtc` expects for address/script building. */
export function sbtcNetwork(network: 'mainnet' | 'testnet'): BitcoinNetwork {
  return network === 'mainnet' ? SBTC_MAINNET : SBTC_TESTNET;
}

/** Broadcast a finalized raw Bitcoin transaction (hex) via the configured Bitcoin API; returns the txid. */
export async function broadcastRawTx(
  apiConfig: NetworkConfig,
  rawTxHex: string,
  platform?: 'native' | 'web',
): Promise<string> {
  const url = `${apiConfig.bitcoinApiUrl.replace(/\/$/, '')}/tx`;
  assertHttps(url, platform);
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', body: rawTxHex });
  } catch (originalError) {
    throw new SbtcError({ code: SbtcErrorCode.NETWORK_TIMEOUT, originalError, platform, context: { url } });
  }
  const text = (await response.text()).trim();
  if (!response.ok) {
    throw new SbtcError({
      code: SbtcErrorCode.NETWORK_TIMEOUT,
      message: text || `Broadcast failed (${response.status}).`,
      platform,
      context: { url, status: response.status },
    });
  }
  return text;
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
    throw new SbtcError({ code: SbtcErrorCode.NETWORK_TIMEOUT, originalError, platform, context: { url } });
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

/** Emily withdrawal status. Shape is UNVERIFIED — confirm before M6 integration (T061/T062). */
interface EmilyWithdrawal {
  status: string;
  statusMessage?: string;
  bitcoinTxid?: string;
  fulfillment?: { bitcoinTxid?: string } | null;
}

export async function fetchWithdrawalStatus(
  apiConfig: NetworkConfig,
  stacksTxid: string,
  platform?: 'native' | 'web',
): Promise<{ status: string; statusMessage?: string; bitcoinTxid?: string }> {
  const url = `${apiConfig.emilyApiUrl.replace(/\/$/, '')}/withdrawal/${stacksTxid}`;
  const res = await fetchJson<EmilyWithdrawal>(url, { platform });
  return {
    status: res.status,
    statusMessage: res.statusMessage,
    bitcoinTxid: res.bitcoinTxid ?? res.fulfillment?.bitcoinTxid,
  };
}

/** Terminal/in-flight classification of Emily's free-form status string. */
export type EmilyOutcome = 'pending' | 'confirmed' | 'failed';

/**
 * Map Emily's wire status (`pending`/`accepted`/`confirmed`/`failed`, case- and
 * spelling-tolerant) to the hook's terminal model: anything not clearly confirmed
 * or failed is treated as still pending.
 */
export function mapEmilyStatus(status: string): EmilyOutcome {
  const s = status.trim().toLowerCase();
  if (s === 'confirmed') return 'confirmed';
  if (s === 'failed' || s === 'rejected') return 'failed';
  return 'pending';
}
