/**
 * Polyfill note: Node `stream` support on React Native (Metro alias).
 *
 * Run last by `polyfills/index.ts` (buffer → crypto → streams). Unlike `Buffer`
 * and `crypto`, Node streams CANNOT be installed via a runtime global: transitive
 * `@stacks/*` / `@scure/*` code does `require('stream')`, and that specifier is
 * resolved by the bundler, not by anything on `globalThis`. So the fix is a Metro
 * resolver alias, not a runtime assignment:
 *
 *   // metro.config.js (shipped as packages/core/templates/metro.config.js, T013)
 *   config.resolver.extraNodeModules = {
 *     ...config.resolver.extraNodeModules,
 *     stream: require.resolve('readable-stream'),
 *   };
 *
 * `readable-stream` is a runtime dependency of `@sbtc/sdk`, so the alias target
 * resolves without the consumer installing anything extra. On web, bundlers
 * provide their own `stream` shim or it is unneeded.
 *
 * `applyStreamsPolyfill()` performs no runtime mutation (stream support is purely
 * a bundler concern); the idempotent flag keeps the buffer→crypto→streams chain's
 * contract consistent and gives a stable hook for a future dev-time diagnostic.
 */

const STREAMS_FLAG = '__sbtcSdkStreamsPolyfilled';

/** No-op aside from an idempotent marker — see the module doc for why. */
export function applyStreamsPolyfill(): void {
  const host = globalThis as unknown as Record<string, unknown>;
  if (host[STREAMS_FLAG] !== true) {
    host[STREAMS_FLAG] = true;
  }
}
