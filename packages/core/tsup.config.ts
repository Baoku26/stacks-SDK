import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    // Separate side-effect-only entry so `@sbtc/sdk/polyfills` can be imported
    // first on React Native without pulling in the rest of the SDK. See MEMORY.md
    // [BUILD] tsup dual output and polyfills entry.
    polyfills: 'src/polyfills/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Let consumers' bundlers (Metro on native, webpack/Vite on web) provide and
  // tree-shake these. Native deps are absent from web installs and vice versa.
  external: [
    'react',
    'react-native',
    'expo-secure-store',
    'expo-local-authentication',
    '@stacks/connect',
  ],
});
