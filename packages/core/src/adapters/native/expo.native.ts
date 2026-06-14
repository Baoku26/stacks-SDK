/**
 * React Native (Metro) variant of the Expo module loaders — STATIC imports.
 *
 * Selected over `expo.ts` in the tsup native build via esbuild
 * `resolveExtensions` (`.native.ts` wins), and surfaced to consumers through the
 * package.json `react-native` export condition. Static (not dynamic `import()`)
 * because Metro cannot resolve a dynamic import of a node module from inside a
 * pre-bundled dependency at runtime. See `expo.ts` for the full rationale.
 *
 * The loaders stay async (return a resolved Promise) so the `NativeAdapter` call
 * sites (`await loadSecureStore()`) are identical across both variants.
 */
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Linking from 'expo-linking';

export const loadSecureStore = (): Promise<typeof import('expo-secure-store')> =>
  Promise.resolve(SecureStore);

export const loadLocalAuthentication = (): Promise<typeof import('expo-local-authentication')> =>
  Promise.resolve(LocalAuthentication);

export const loadLinking = (): Promise<typeof import('expo-linking')> => Promise.resolve(Linking);
