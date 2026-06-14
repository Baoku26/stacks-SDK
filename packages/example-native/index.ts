// MUST be the first import in the app entry, before any module that may touch
// Buffer / crypto (e.g. @stacks/*). On web this is a no-op. The failure mode is
// silent and looks unrelated — see MEMORY.md → [POLYFILLS] import order.
import '@baoku26/sbtc-sdk/polyfills';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
