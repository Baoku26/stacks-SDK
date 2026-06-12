import type { PlatformAdapter } from './types';
import { NativeAdapter } from './native';
import { WebAdapter } from './web';
import { SsrAdapter } from './ssr';

/**
 * Selects the platform adapter at runtime. Order is significant
 * (MEMORY.md → [ADAPTERS] Platform detection order):
 *
 *  1. React Native — detected via `navigator.product === 'ReactNative'`, the
 *     import-free RN signal. We deliberately do NOT use `Platform.OS`: a static
 *     `import { Platform } from 'react-native'` would break web bundles, where
 *     react-native is an optional native peer the bundler can't resolve. Expo Web
 *     is correctly NOT matched here (its `navigator.product` is the browser's),
 *     so it falls through to the WebAdapter below.
 *  2. Browser (including Expo Web) — `typeof window !== 'undefined'`.
 *  3. SSR / non-browser server environment — everything else.
 *
 * Consumers can bypass this entirely by passing an `adapter` prop to SbtcProvider.
 */
export function detectAdapter(): PlatformAdapter {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return new NativeAdapter();
  }
  if (typeof window !== 'undefined') {
    return new WebAdapter();
  }
  return new SsrAdapter();
}
