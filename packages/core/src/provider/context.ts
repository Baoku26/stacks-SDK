import { createContext, useContext } from 'react';
import type { SbtcContextValue } from './types';

/**
 * The SDK context. `null` until an {@link SbtcProvider} provides a value.
 * Internal — not part of the public API (hooks read it via `useSbtcContext`).
 */
export const SbtcContext = createContext<SbtcContextValue | null>(null);

/**
 * Returns the current SDK context. Throws if called outside an `<SbtcProvider>`
 * (a developer error, not a recoverable runtime condition).
 */
export function useSbtcContext(): SbtcContextValue {
  const value = useContext(SbtcContext);
  if (value === null) {
    throw new Error('useSbtcContext must be used within an <SbtcProvider>.');
  }
  return value;
}
