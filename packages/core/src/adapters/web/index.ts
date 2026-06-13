import type { AuthAdapter, ConnectAdapter, PlatformAdapter, StorageAdapter } from '../types';
import { createWebStorage } from './storage';
import { createWebAuth, type WebAuthOptions } from './auth';
import { createWebConnect } from './connect';

/** Options for {@link WebAdapter}. Currently only the auth options (passphrase fallback / rp name). */
export type WebAdapterOptions = WebAuthOptions;

/**
 * Browser adapter: `localStorage` + AES-GCM storage, WebAuthn-with-passphrase
 * auth, and `@stacks/connect` extension popups.
 *
 * BUNDLE SEPARATION: `connect.ts` loads `@stacks/connect` via a dynamic
 * `import()`, never a static one. `detect.ts` references both WebAdapter and
 * NativeAdapter, so a static `import '@stacks/connect'` here would be pulled into
 * native bundles and break them (MEMORY.md → [ADAPTERS] tree-shaking).
 */
export class WebAdapter implements PlatformAdapter {
  readonly platform = 'web' as const;
  readonly storage: StorageAdapter;
  readonly auth: AuthAdapter;
  readonly connect: ConnectAdapter;

  constructor(options?: WebAdapterOptions) {
    this.storage = createWebStorage();
    this.auth = createWebAuth(options);
    this.connect = createWebConnect();
  }
}
