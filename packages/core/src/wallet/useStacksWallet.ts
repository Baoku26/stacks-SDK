import { useCallback, useEffect, useRef, useState } from 'react';
import { generateSecretKey } from '@stacks/wallet-sdk';
import { SbtcError, SbtcErrorCode } from '../errors';
import { withAuthGuard } from '../adapters/auth-guard';
import { useSbtcContext } from '../provider/context';
import { deriveAccount } from './derive';
import type { Account, WalletState } from './types';

/** Secure-store key holding the BIP39 mnemonic (MEMORY.md → [ADAPTERS / NATIVE] 2KB limit). */
const WALLET_KEY = '@sbtc_sdk/wallet_v1';

const INITIAL_STATE: WalletState = {
  address: null,
  btcAddress: null,
  publicKey: null,
  isLoaded: false,
  isLocked: false,
  error: null,
};

/** Return value of {@link useStacksWallet}. */
export interface UseStacksWalletResult extends WalletState {
  /** Creates a new 24-word wallet, persists it, and loads its addresses. */
  generateWallet: () => Promise<void>;
  /** Restores a wallet from a BIP39 mnemonic. Sets `error` to INVALID_MNEMONIC if invalid. */
  restoreWallet: (mnemonic: string) => Promise<void>;
  /** Forgets the in-memory addresses for this session (keys remain in secure storage). */
  lockWallet: () => void;
  /** Returns the mnemonic after an auth prompt. REJECTS on auth failure (AUTH_FAILED). */
  exportMnemonic: () => Promise<string>;
  /** Deletes the wallet from storage after an auth prompt. REJECTS on auth failure. */
  clearWallet: () => Promise<void>;
}

function toSbtcError(error: unknown, platform: 'native' | 'web'): SbtcError {
  return error instanceof SbtcError
    ? error
    : new SbtcError({ code: SbtcErrorCode.STORAGE_ERROR, originalError: error, platform });
}

/**
 * Platform-agnostic HD wallet hook. Uses `useSbtcContext().adapter` for all
 * storage/auth — no platform APIs here. Keys live only in secure storage; the
 * mnemonic is never placed in React state. SSR-safe: initial render is the
 * unloaded state, and the load effect runs only on the client/native.
 *
 * `exportMnemonic` / `clearWallet` are gated by `withAuthGuard` (SR-3) and reject
 * on auth failure; `generate`/`restore` surface errors via the `error` field.
 */
export function useStacksWallet(): UseStacksWalletResult {
  const { adapter, network } = useSbtcContext();
  const [state, setState] = useState<WalletState>(INITIAL_STATE);
  const mountedRef = useRef(true);

  const applyAccount = useCallback((account: Account) => {
    setState({
      address: account.address,
      btcAddress: account.btcAddress,
      publicKey: account.publicKey,
      isLoaded: true,
      isLocked: false,
      error: null,
    });
  }, []);

  // Load any persisted wallet on mount.
  useEffect(() => {
    mountedRef.current = true;

    // SSR: a web adapter with no `window` is the server — skip. Native always runs.
    if (adapter.platform === 'web' && typeof window === 'undefined') {
      return;
    }

    void (async () => {
      try {
        const mnemonic = await adapter.storage.get(WALLET_KEY);
        if (!mountedRef.current) return;
        if (mnemonic === null) {
          setState((s) => ({ ...s, isLoaded: true }));
          return;
        }
        const account = await deriveAccount(mnemonic, network);
        if (!mountedRef.current) return;
        applyAccount(account);
      } catch (error) {
        if (!mountedRef.current) return;
        setState((s) => ({ ...s, isLoaded: true, error: toSbtcError(error, adapter.platform) }));
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [adapter, network, applyAccount]);

  const generateWallet = useCallback(async () => {
    try {
      const mnemonic = generateSecretKey(256); // 24 words
      const account = await deriveAccount(mnemonic, network);
      await adapter.storage.set(WALLET_KEY, mnemonic);
      if (!mountedRef.current) return;
      applyAccount(account);
    } catch (error) {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, error: toSbtcError(error, adapter.platform) }));
    }
  }, [adapter, network, applyAccount]);

  const restoreWallet = useCallback(
    async (mnemonic: string) => {
      try {
        const account = await deriveAccount(mnemonic, network); // throws INVALID_MNEMONIC
        await adapter.storage.set(WALLET_KEY, mnemonic);
        if (!mountedRef.current) return;
        applyAccount(account);
      } catch (error) {
        if (!mountedRef.current) return;
        setState((s) => ({ ...s, error: toSbtcError(error, adapter.platform) }));
      }
    },
    [adapter, network, applyAccount],
  );

  const lockWallet = useCallback(() => {
    setState((s) => ({ ...s, address: null, btcAddress: null, publicKey: null, isLocked: true }));
  }, []);

  const exportMnemonic = useCallback(
    (): Promise<string> =>
      withAuthGuard(
        adapter,
        async () => {
          const mnemonic = await adapter.storage.get(WALLET_KEY);
          if (mnemonic === null) {
            throw new SbtcError({
              code: SbtcErrorCode.WALLET_NOT_FOUND,
              platform: adapter.platform,
            });
          }
          return mnemonic;
        },
        'Export recovery phrase',
      ),
    [adapter],
  );

  const clearWallet = useCallback(async () => {
    await withAuthGuard(adapter, () => adapter.storage.remove(WALLET_KEY), 'Delete wallet');
    if (!mountedRef.current) return;
    setState({ ...INITIAL_STATE, isLoaded: true });
  }, [adapter]);

  return { ...state, generateWallet, restoreWallet, lockWallet, exportMnemonic, clearWallet };
}
