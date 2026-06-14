import { defineConfig } from 'tsup';

// Peers/native modules the consumer's bundler provides and tree-shakes (Metro on
// native, webpack/Vite on web). Native deps are absent from web installs and
// vice versa, so they must never be bundled in.
const external = [
  'react',
  'react-native',
  'expo-secure-store',
  'expo-local-authentication',
  'expo-linking',
  '@stacks/connect',
];

// `.native.*`-first resolution order for the React Native build, mirroring how
// Metro resolves platform files. Makes esbuild pick `adapters/native/expo.native.ts`
// (STATIC expo-* imports) over `expo.ts` (dynamic `import()`).
const nativeResolveExtensions = [
  '.native.tsx',
  '.native.ts',
  '.native.jsx',
  '.native.js',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
];

export default defineConfig([
  // Web / default build. `expo-*` are loaded via dynamic `import()` (expo.ts) so
  // they stay out of the web static graph. Also emits the polyfills entry.
  {
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
    external,
  },
  // React Native build, consumed via the package.json `react-native` export
  // condition. esbuild `resolveExtensions` prefers `*.native.ts`, so the native
  // adapter loads `expo-*` via STATIC imports (`expo.native.ts`) — Metro cannot
  // resolve a dynamic `import()` of a node module from a pre-bundled dep at
  // runtime ("Requiring unknown module N"). See MEMORY.md [ADAPTERS] native
  // module loading.
  {
    entry: { 'index.native': 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: false, // must not wipe the default build emitted above
    treeshake: true,
    external,
    esbuildOptions(options) {
      options.resolveExtensions = nativeResolveExtensions;
    },
  },
]);
