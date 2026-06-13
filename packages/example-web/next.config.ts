import type { NextConfig } from 'next';

// Native-only optional peers of @sbtc/sdk. The WebAdapter never calls into them,
// but the bundler still traverses the NativeAdapter's dynamic `import('expo-…')`
// and would pull in `react-native` (Flow syntax → parse failure). Alias them to an
// empty module for the web build. A standalone web consumer that never installs the
// expo packages needs the same config — this is the documented web-setup step.
const NATIVE_ONLY = [
  'expo-secure-store',
  'expo-local-authentication',
  'expo-linking',
  'react-native',
] as const;

const emptyModule = './stubs/native-empty.ts';

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: Object.fromEntries(NATIVE_ONLY.map((pkg) => [pkg, emptyModule])),
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...Object.fromEntries(NATIVE_ONLY.map((pkg) => [pkg, false])),
    };
    return config;
  },
};

export default nextConfig;
