// Native-only polyfill entry point for @sbtc/sdk.
//
// On React Native this must be the FIRST import in the app entry (index.js),
// loading buffer → crypto → streams in order. On web it is a no-op — the
// browser already provides these globals. Implemented in T009–T012.

if (typeof window === 'undefined') {
  // Native / non-browser environment: real polyfills are wired up in T009–T012.
}

export {};
