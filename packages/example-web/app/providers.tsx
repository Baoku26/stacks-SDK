'use client';

import type { ReactNode } from 'react';
import { SbtcProvider } from '@baoku26/sbtc-sdk';

/**
 * Client-side SDK provider. `SbtcProvider` auto-detects the platform: it uses the
 * SsrAdapter during the server render and swaps to the WebAdapter once mounted in
 * the browser. No `adapter` prop is passed, so this is the default web path —
 * encrypted localStorage + WebAuthn/passphrase auth + @stacks/connect signing.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <SbtcProvider network="testnet">{children}</SbtcProvider>;
}
