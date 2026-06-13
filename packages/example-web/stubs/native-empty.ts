// Empty stub for the SDK's native-only optional peers (expo-*, react-native).
//
// `@sbtc/sdk` resolves the platform adapter at runtime; on web the WebAdapter is
// always selected and the NativeAdapter's `import('expo-…')` calls never execute.
// But web bundlers (Turbopack/webpack) still traverse those dynamic imports to
// build chunks, which drags in `react-native` (Flow syntax → parse error). Aliasing
// the native packages to this empty module stops that traversal. See next.config.ts.
export {};
