import type { AuthAdapter } from '../types';

/**
 * Native authentication via `expo-local-authentication` (Face ID / Touch ID /
 * fingerprint, with the OS device-passcode fallback). Imported dynamically to
 * keep it out of web bundles.
 *
 * Returns booleans per the {@link AuthAdapter} contract — `withAuthGuard` turns a
 * `false` into `AUTH_FAILED` / an unavailable mechanism into `AUTH_UNAVAILABLE`.
 */
export function createNativeAuth(): AuthAdapter {
  return {
    async isAvailable() {
      const LocalAuthentication = await import('expo-local-authentication');
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      // NOTE (M2): treats biometrics-enrolled as the availability signal. Devices
      // with only a passcode (no enrolled biometrics) can still authenticate via
      // the OS fallback in `prompt()`; broadening `isAvailable` for that case is a
      // later refinement.
      return hasHardware && isEnrolled;
    },

    async prompt(reason) {
      const LocalAuthentication = await import('expo-local-authentication');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        // Allow the OS passcode fallback when biometrics fail/aren't enrolled.
        disableDeviceFallback: false,
      });
      return result.success;
    },
  };
}
