// `react-native-get-random-values` ships no type declarations. It is a
// side-effect-only import that installs a native, cryptographically-secure
// `crypto.getRandomValues` on React Native. Declaring it as an untyped module
// lets the side-effect import typecheck without pulling in @types/node.
declare module 'react-native-get-random-values';
