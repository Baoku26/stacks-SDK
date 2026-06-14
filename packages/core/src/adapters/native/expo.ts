/**
 * Lazy loaders for the Expo native modules used by `NativeAdapter`.
 *
 * This (default) variant uses dynamic `import()`, so the `expo-*` packages stay
 * OUT of the web build's static module graph — they're absent from web installs,
 * so on web they become never-executed lazy chunks.
 *
 * The `.native` sibling (`expo.native.ts`) replaces this with STATIC imports for
 * the React Native build: Metro cannot resolve a dynamic `import()` of a node
 * module from inside a pre-bundled dependency at runtime (it throws "Requiring
 * unknown module N"), so native must import the modules eagerly. Build selection
 * is by esbuild `resolveExtensions` (tsup native build) surfaced via the
 * package.json `react-native` export condition. See MEMORY.md → [ADAPTERS]
 * native module loading (Metro dynamic-import fix).
 */
export const loadSecureStore = (): Promise<typeof import('expo-secure-store')> =>
  import('expo-secure-store');

export const loadLocalAuthentication = (): Promise<typeof import('expo-local-authentication')> =>
  import('expo-local-authentication');

export const loadLinking = (): Promise<typeof import('expo-linking')> => import('expo-linking');
