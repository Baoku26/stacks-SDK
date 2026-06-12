/**
 * Network endpoint configuration.
 *
 * MINIMAL version created to unblock `SbtcProvider` (T022). T042 (M4) finalizes
 * this module. The Emily base URLs are UNVERIFIED — confirm before M5
 * (see MEMORY.md → [ADAPTERS / WEB] Emily API base URLs to verify before M5).
 *
 * Dependency-free by design (PLANNING.md: `utils/` has zero internal deps).
 */

/** Fully-resolved API endpoints for a network. */
export interface NetworkConfig {
  hiroApiUrl: string;
  emilyApiUrl: string;
  bitcoinApiUrl: string;
}

export const MAINNET: NetworkConfig = {
  hiroApiUrl: 'https://api.hiro.so',
  emilyApiUrl: 'https://emily.stacks.co',
  bitcoinApiUrl: 'https://mempool.space/api',
};

export const TESTNET: NetworkConfig = {
  hiroApiUrl: 'https://api.testnet.hiro.so',
  emilyApiUrl: 'https://emily.testnet.stacks.co',
  bitcoinApiUrl: 'https://mempool.space/testnet/api',
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
  };
}
