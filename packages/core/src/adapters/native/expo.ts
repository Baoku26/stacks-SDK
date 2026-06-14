/**
 * Web / default variant of the Expo native-module loaders.
 *
 * On web the WebAdapter is always selected by `detectAdapter()`, so `NativeAdapter`
 * — and therefore these loaders — is never instantiated. The bodies deliberately
 * contain NO runtime `import('expo-*')`: the `typeof import('expo-*')` in the
 * return annotations is a TYPE query (erased at build), so web bundlers
 * (webpack / Turbopack / Vite) never traverse into `expo-*` → `react-native`
 * (whose Flow syntax breaks web builds). This is what lets a web consumer install
 * `@baoku26/sbtc-sdk` with NO bundler-alias step.
 *
 * The `.native` sibling (`expo.native.ts`) provides the real STATIC imports for
 * React Native, selected via esbuild `resolveExtensions` in the tsup native build
 * + the package.json `react-native` export condition. See MEMORY.md → [ADAPTERS]
 * native module loading + web-graph isolation.
 */
const nativeOnly = (feature: string): Promise<never> =>
  Promise.reject(
    new Error(
      `[sbtc-sdk] native ${feature} is unavailable on web — NativeAdapter is never selected here. ` +
        `This loader is unreachable on web; if you see this, the platform adapter was forced incorrectly.`,
    ),
  );

export const loadSecureStore = (): Promise<typeof import('expo-secure-store')> =>
  nativeOnly('secure storage');

export const loadLocalAuthentication = (): Promise<typeof import('expo-local-authentication')> =>
  nativeOnly('local authentication');

export const loadLinking = (): Promise<typeof import('expo-linking')> =>
  nativeOnly('deep linking');
