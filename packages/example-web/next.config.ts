import type { NextConfig } from 'next';

// No bundler aliases needed for @baoku26/sbtc-sdk. The SDK's web build contains no runtime
// `import('expo-*')` — the native module loaders are type-only on web — so the
// bundler never traverses into `expo-*` / `react-native`. (Previously this config
// had to alias those native-only peers to an empty module; that step is gone as of
// the web-graph-isolation fix. See core MEMORY.md → [ADAPTERS] native module
// loading + web-graph isolation.)
const nextConfig: NextConfig = {};

export default nextConfig;
