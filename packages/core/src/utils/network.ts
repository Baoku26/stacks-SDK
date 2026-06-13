/**
 * Network endpoint configuration. Owned by T042 (M4); dependency-free by design
 * (PLANNING.md: `utils/` has zero internal deps).
 *
 * All endpoints VERIFIED 2026-06-13 (MEMORY.md → [DATA] sBTC token contract
 * VERIFIED, [SBTC] Emily API base URLs VERIFIED): the sBTC `sbtcTokenAssetId`
 * against the live Hiro API, and the Emily base URLs against the official `sbtc`
 * package defaults + live `/limits` probes.
 */

/** Fully-resolved API endpoints for a network. */
export interface NetworkConfig {
  hiroApiUrl: string;
  emilyApiUrl: string;
  bitcoinApiUrl: string;
  /** SIP-010 asset id `<contract>::<asset>` used to read the sBTC FT balance. */
  sbtcTokenAssetId: string;
  /** `<address>.sbtc-withdrawal` contract for `initiate-withdrawal-request` (M6). */
  sbtcWithdrawalContract: string;
}

export const MAINNET: NetworkConfig = {
  hiroApiUrl: 'https://api.hiro.so',
  emilyApiUrl: 'https://sbtc-emily.com',
  bitcoinApiUrl: 'https://mempool.space/api',
  // VERIFIED 2026-06-13 (Hiro mainnet API): FT asset name is `sbtc-token`.
  sbtcTokenAssetId: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token',
  // VERIFIED 2026-06-13 (Hiro mainnet API): `initiate-withdrawal-request` present.
  sbtcWithdrawalContract: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-withdrawal',
};

export const TESTNET: NetworkConfig = {
  hiroApiUrl: 'https://api.testnet.hiro.so',
  emilyApiUrl: 'https://beta.sbtc-emily.com',
  bitcoinApiUrl: 'https://mempool.space/testnet/api',
  // VERIFIED 2026-06-13 (Hiro testnet API): a real holder's balances key matches exactly.
  sbtcTokenAssetId: 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token::sbtc-token',
  // PROVISIONAL: testnet sBTC deployments churn; this deployer's `sbtc-withdrawal`
  // is not currently deployed (MEMORY.md → [SBTC] testnet deployment churn).
  // Override via `SbtcProvider apiConfig` to match the live testnet deployment.
  sbtcWithdrawalContract: 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-withdrawal',
};

/** Merge optional endpoint overrides onto the selected network's defaults. */
export function resolveApiConfig(
  network: 'mainnet' | 'testnet',
  overrides?: Partial<NetworkConfig>,
): NetworkConfig {
  const base = network === 'mainnet' ? MAINNET : TESTNET;
  return {
    hiroApiUrl: overrides?.hiroApiUrl ?? base.hiroApiUrl,
    emilyApiUrl: overrides?.emilyApiUrl ?? base.emilyApiUrl,
    bitcoinApiUrl: overrides?.bitcoinApiUrl ?? base.bitcoinApiUrl,
    sbtcTokenAssetId: overrides?.sbtcTokenAssetId ?? base.sbtcTokenAssetId,
    sbtcWithdrawalContract: overrides?.sbtcWithdrawalContract ?? base.sbtcWithdrawalContract,
  };
}
