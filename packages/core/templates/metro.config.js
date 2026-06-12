// metro.config.js — template for using @sbtc/sdk on React Native / Expo.
//
// Copy this file into your project ROOT (next to package.json). It adds the one
// bundler-level alias @sbtc/sdk needs on native: Node's `stream` module.
// Transitive @stacks/@scure dependencies do `require('stream')`, and unlike
// `Buffer` / `crypto` that cannot be fixed by a runtime global — module
// resolution is Metro's job, not something on `globalThis`. `readable-stream`
// ships as a dependency of @sbtc/sdk, so the alias target resolves with no extra
// install on your side.
//
// IMPORTANT — this file does NOT replace the polyfill import. You must ALSO add,
// as the FIRST line of your app entry (e.g. index.js), before any other import:
//
//   import '@sbtc/sdk/polyfills';
//
// ---------------------------------------------------------------------------
// Expo (managed or bare): this extends `expo/metro-config`.
// Bare React Native without Expo: swap the require below for
//   const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
// and merge the resolver change instead of mutating in place.
// ---------------------------------------------------------------------------

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // Node `stream` → readable-stream (required by @stacks/@scure on Hermes).
  stream: require.resolve('readable-stream'),
};

module.exports = config;
