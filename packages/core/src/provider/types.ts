import type { ReactNode } from 'react';
import type { PlatformAdapter } from '../adapters/types';
import type { NetworkConfig } from '../utils/network';

/** Which Stacks/Bitcoin network the SDK targets. */
export type NetworkMode = 'mainnet' | 'testnet';

/** Optional API endpoint overrides passed to {@link SbtcProviderProps.apiConfig} (PRD §9.2). */
export type ApiConfig = Partial<NetworkConfig>;

/** Props for {@link SbtcProvider} (PRD §9.2). */
export interface SbtcProviderProps {
  network: NetworkMode;
  /** Overrides platform auto-detection — e.g. a custom HSM/hardware-wallet adapter. */
  adapter?: PlatformAdapter;
  /** Overrides the default Hiro / Emily / Bitcoin endpoints. */
  apiConfig?: ApiConfig;
  children: ReactNode;
}

/** Value provided on the SDK context and read via `useSbtcContext()`. */
export interface SbtcContextValue {
  network: NetworkMode;
  adapter: PlatformAdapter;
  /** Fully-resolved endpoints: network defaults merged with any `apiConfig` overrides. */
  apiConfig: NetworkConfig;
}
