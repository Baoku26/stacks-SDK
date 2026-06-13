/**
 * Polyfill: `global.Buffer` and `global.process` (native only).
 *
 * `@peculiar/webcrypto` (crypto.ts) and several `@stacks/*` / `@scure/*` modules
 * capture `global.Buffer` at init, so it must exist before they evaluate — which
 * is why `polyfills/index.ts` runs this first. See MEMORY.md → [POLYFILLS].
 *
 * The work is exported as `applyBufferPolyfill()` rather than run on import, so
 * `polyfills/index.ts` can invoke it ONLY off the browser path. Idempotent
 * (FR-2.2): only assigns what is missing.
 */
import { Buffer } from 'buffer';

/** The subset of Node's `process` that `@stacks/*` and friends actually touch. */
interface ProcessShim {
  env: Record<string, string | undefined>;
  nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void;
  browser: boolean;
  version: string;
  platform: string;
}

// `Omit` the two keys before re-declaring them: `@types/node` can leak into the
// program via a dependency's `/// <reference types="node">` (e.g. @stacks/*),
// which would type `globalThis.process` as `NodeJS.Process` and reject our RN
// `platform: 'react-native'` shim. Decoupling from the global declarations keeps
// this file correct whether or not node types are present.
type PolyfilledGlobal = Omit<typeof globalThis, 'Buffer' | 'process'> & {
  Buffer?: typeof Buffer;
  process?: ProcessShim;
};

// Closest match to Node's `process.nextTick` without depending on a process pkg.
const nextTick: ProcessShim['nextTick'] = (callback, ...args) => {
  Promise.resolve().then(() => callback(...args));
};

/** Idempotently install `Buffer` and a minimal `process` onto the global object. */
export function applyBufferPolyfill(): void {
  const g = globalThis as unknown as PolyfilledGlobal;

  if (typeof g.Buffer === 'undefined') {
    g.Buffer = Buffer;
  }

  if (typeof g.process === 'undefined') {
    g.process = {
      env: {},
      nextTick,
      browser: false,
      version: '',
      platform: 'react-native',
    };
  } else {
    // React Native ships a partial `process`; backfill the fields libraries use
    // without clobbering anything the runtime already provided.
    const existing = g.process as Partial<ProcessShim>;
    if (typeof existing.env === 'undefined') {
      existing.env = {};
    }
    if (typeof existing.nextTick !== 'function') {
      existing.nextTick = nextTick;
    }
  }
}
