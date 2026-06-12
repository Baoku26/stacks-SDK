// Public API barrel for @sbtc/sdk.
//
// Populated across M1 — only the symbols listed in PRD §9.1 are exported here.
// Internal modules (emily.ts, adapter internals, storage.ts) are NOT exported.
// Full wiring in T024.

// Errors (PRD §9.1)
export { SbtcError, SbtcErrorCode } from './errors';
