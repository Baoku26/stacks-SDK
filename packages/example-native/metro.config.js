// metro.config.js — @sbtc/sdk requires Node's `stream` aliased to readable-stream
// on React Native (transitive @stacks/@scure deps do `require('stream')`, which
// Hermes lacks). Mirrors packages/core/templates/metro.config.js.
//
// IMPORTANT: this does NOT replace the polyfill import. `index.ts` must keep
// `import '@sbtc/sdk/polyfills';` as its FIRST line.

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve('readable-stream'),
};

module.exports = config;
