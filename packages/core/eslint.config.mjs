// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      // The SDK runs in both browser and React Native (Hermes) contexts.
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // No `any` in the public surface (CLAUDE.md → Coding Rules). Narrow FFI
      // boundaries (postMessage / SAB-style) may opt out with an inline
      // eslint-disable-next-line + a comment explaining why.
      '@typescript-eslint/no-explicit-any': 'error',

      // Only `console.error('[sbtc-sdk]', …)` is allowed anywhere in the SDK.
      'no-console': ['error', { allow: ['error'] }],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // THE ADAPTER RULE (MEMORY.md → [ADAPTERS]; PLANNING.md → Module Dependency Graph).
  // Platform-agnostic hooks must reach platform behaviour ONLY through
  // useSbtcContext().adapter — never by importing a platform package or a
  // concrete native/web adapter, and never by touching a platform global.
  {
    files: ['src/wallet/**/*.{ts,tsx}', 'src/sbtc/**/*.{ts,tsx}', 'src/contracts/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-secure-store',
              message: 'Hooks must use adapter.storage, not expo-secure-store directly.',
            },
            {
              name: 'expo-local-authentication',
              message: 'Hooks must use adapter.auth, not expo-local-authentication directly.',
            },
            {
              name: '@stacks/connect',
              message: 'Hooks must use adapter.connect, not @stacks/connect directly.',
            },
          ],
          patterns: [
            {
              group: [
                '**/adapters/native',
                '**/adapters/native/**',
                '**/adapters/web',
                '**/adapters/web/**',
              ],
              message: 'Never import a concrete adapter. Get it from useSbtcContext().adapter.',
            },
          ],
        },
      ],
      // localStorage is a browser global, not an import — block it explicitly.
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Hooks must use adapter.storage, not localStorage directly.',
        },
      ],
    },
  },
);
