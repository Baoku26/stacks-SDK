import { describe, it, expect, afterEach, vi } from 'vitest';
import { detectAdapter } from './detect';
import { NativeAdapter } from './native';
import { WebAdapter } from './web';
import { SsrAdapter } from './ssr';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectAdapter', () => {
  it('returns NativeAdapter in React Native (navigator.product === "ReactNative")', () => {
    vi.stubGlobal('navigator', { product: 'ReactNative' });
    // window is irrelevant — the RN check comes first.
    expect(detectAdapter()).toBeInstanceOf(NativeAdapter);
  });

  it('returns WebAdapter in a browser (window present, not React Native)', () => {
    vi.stubGlobal('navigator', { product: 'Gecko' });
    vi.stubGlobal('window', {});
    expect(detectAdapter()).toBeInstanceOf(WebAdapter);
  });

  it('returns WebAdapter on Expo Web (browser navigator, not "ReactNative")', () => {
    // Expo Web runs in a browser, so navigator.product is the browser's, not RN.
    vi.stubGlobal('navigator', { product: 'Gecko' });
    vi.stubGlobal('window', {});
    expect(detectAdapter()).toBeInstanceOf(WebAdapter);
  });

  it('returns SsrAdapter on the server (no window, not React Native)', () => {
    vi.stubGlobal('navigator', { product: 'Node' });
    vi.stubGlobal('window', undefined);
    expect(detectAdapter()).toBeInstanceOf(SsrAdapter);
  });
});
