'use client';

import { useState } from 'react';
import {
  useStacksWallet,
  useSbtcContext,
  useSbtcBalance,
  useStxBalance,
  useSbtcDeposit,
  useSbtcWithdraw,
  WithdrawalStatus,
  SbtcError,
  type WalletApp,
} from '@baoku26/sbtc-sdk';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="break-all font-mono text-sm text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'subtle';
}) {
  const base =
    'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const styles =
    variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-500'
      : variant === 'subtle'
        ? 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
        : 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300';
  return (
    <button className={`${base} ${styles}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </label>
  );
}

/** A wallet account connected via the browser extension (Leather / Xverse). */
interface ConnectedAccount {
  stxAddress: string;
  stxPublicKey: string;
  btcAddress: string;
  btcPublicKey: string;
}

/**
 * Pick the Stacks account + the native-SegWit (p2wpkh) Bitcoin payment account out
 * of the addresses returned by `@stacks/connect`'s `connect()`. We avoid the
 * taproot (`…1p…`) entry — sBTC deposits fund from the p2wpkh payment account.
 */
function pickAccount(
  addresses: { address: string; publicKey: string }[],
): ConnectedAccount | null {
  const stx = addresses.find((a) => /^S[PT]/.test(a.address));
  const btc =
    addresses.find((a) => /^(bc1q|tb1q)/.test(a.address)) ??
    addresses.find((a) => /^(bc1|tb1)/.test(a.address) && !/^(bc1p|tb1p)/.test(a.address));
  if (!stx || !btc) return null;
  return {
    stxAddress: stx.address,
    stxPublicKey: stx.publicKey,
    btcAddress: btc.address,
    btcPublicKey: btc.publicKey,
  };
}

export default function Home() {
  const wallet = useStacksWallet();
  const { adapter, network } = useSbtcContext();

  const [exported, setExported] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletApp[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Connected browser-extension account (used for deposit / withdraw).
  const [account, setAccount] = useState<ConnectedAccount | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Balances follow the connected account when present, else the local wallet.
  const balanceAddress = account?.stxAddress ?? wallet.address;
  const sbtc = useSbtcBalance(balanceAddress);
  const stx = useStxBalance(balanceAddress);

  // Deposit / withdraw orchestration. Config is read each render, so it tracks the
  // connected account; the deposit/withdraw buttons are disabled until connected.
  const deposit = useSbtcDeposit({
    stacksAddress: account?.stxAddress ?? '',
    bitcoinAddress: account?.btcAddress ?? '',
    paymentPublicKey: account?.btcPublicKey ?? '',
  });
  const withdraw = useSbtcWithdraw({
    stacksAddress: account?.stxAddress ?? '',
    stacksPublicKey: account?.stxPublicKey ?? '',
  });

  const [depositAmount, setDepositAmount] = useState('10000');
  const [withdrawAmount, setWithdrawAmount] = useState('10000');
  const [withdrawTo, setWithdrawTo] = useState('');

  const busy = !wallet.isLoaded;

  async function withErr(fn: () => Promise<void>) {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof SbtcError ? `${e.code}: ${e.message}` : String(e));
    }
  }

  async function connectExtension() {
    setConnecting(true);
    await withErr(async () => {
      // Dynamic import: @stacks/connect touches `window`, so keep it off the SSR path.
      const { connect } = await import('@stacks/connect');
      const result = await connect();
      const picked = pickAccount(result.addresses);
      if (picked === null) {
        throw new Error('Wallet did not return a Stacks + p2wpkh Bitcoin address pair.');
      }
      setAccount(picked);
    });
    setConnecting(false);
  }

  async function disconnectExtension() {
    const { disconnect } = await import('@stacks/connect');
    disconnect();
    setAccount(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          @baoku26/sbtc-sdk — Web example
        </h1>
        <p className="text-sm text-zinc-500">
          Network: <span className="font-mono">{network}</span> · adapter:{' '}
          <span className="font-mono">{adapter.platform}</span>
        </p>
      </header>

      {/* Local wallet */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Local wallet</h2>
        <p className="text-sm text-zinc-500">
          Self-custodial wallet the SDK generates and stores (encrypted localStorage + WebAuthn /
          passphrase auth). Separate from the connected extension below.
        </p>

        {!wallet.isLoaded ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : wallet.address === null ? (
          <p className="text-sm text-zinc-500">
            {wallet.isLocked ? 'Wallet locked.' : 'No wallet yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <Row label="Stacks address" value={wallet.address} />
            <Row label="Bitcoin address" value={wallet.btcAddress ?? '—'} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void withErr(() => wallet.generateWallet())}>
            Generate
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void withErr(async () => {
                const phrase = window.prompt('Enter a 12/24-word recovery phrase');
                if (phrase) await wallet.restoreWallet(phrase.trim());
              })
            }
          >
            Restore
          </Button>
          <Button disabled={busy || wallet.address === null} onClick={() => wallet.lockWallet()}>
            Lock
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void withErr(async () => {
                setExported(await wallet.exportMnemonic());
              })
            }
          >
            Export (auth)
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              void withErr(async () => {
                await wallet.clearWallet();
                setExported(null);
              })
            }
          >
            Clear (auth)
          </Button>
        </div>

        {exported !== null && (
          <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/40">
            <Row label="Exported mnemonic (keep secret)" value={exported} />
            <button
              className="mt-2 text-xs text-amber-700 underline dark:text-amber-400"
              onClick={() => setExported(null)}
            >
              Hide
            </button>
          </div>
        )}

        {wallet.error && (
          <p className="text-sm text-red-600">
            wallet error — {wallet.error.code}: {wallet.error.message}
          </p>
        )}
      </section>

      {/* Connected extension */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Connected wallet (deposit / withdraw)
        </h2>
        <p className="text-sm text-zinc-500">
          Deposit and withdraw sign through a browser extension (Leather / Xverse) via Stacks
          Connect. Connect one to provide the funding account + public keys.
        </p>

        {account === null ? (
          <div>
            <Button disabled={connecting} onClick={() => void connectExtension()}>
              {connecting ? 'Connecting…' : 'Connect extension'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Row label="Stacks account" value={account.stxAddress} />
            <Row label="Bitcoin account (p2wpkh)" value={account.btcAddress} />
            <div>
              <Button variant="subtle" onClick={() => void disconnectExtension()}>
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Balances */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Balances</h2>
          <button
            className="text-xs text-zinc-500 underline disabled:opacity-40"
            disabled={balanceAddress === null || sbtc.isRefreshing || stx.isRefreshing}
            onClick={() => {
              sbtc.refresh();
              stx.refresh();
            }}
          >
            {sbtc.isRefreshing || stx.isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {balanceAddress === null ? (
          <p className="text-sm text-zinc-500">
            Generate a local wallet or connect an extension to see balances.
          </p>
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              For <span className="font-mono">{balanceAddress}</span>
            </p>
            <div className="flex flex-col gap-3">
              <Row label="sBTC" value={sbtc.isLoading ? 'Loading…' : (sbtc.btc ?? '—')} />
              <Row label="STX" value={stx.isLoading ? 'Loading…' : (stx.stx ?? '—')} />
            </div>
          </>
        )}

        {(sbtc.error || stx.error) && (
          <p className="text-sm text-red-600">
            balance error — {(sbtc.error ?? stx.error)?.code}: {(sbtc.error ?? stx.error)?.message}
          </p>
        )}
      </section>

      {/* Deposit */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Deposit BTC → sBTC</h2>
        <Field
          label="Amount (sats)"
          value={depositAmount}
          onChange={setDepositAmount}
          placeholder="10000"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={account === null || Number(depositAmount) <= 0}
            onClick={() => void deposit.deposit(Number(depositAmount))}
          >
            Deposit
          </Button>
          <Button variant="subtle" onClick={() => deposit.reset()}>
            Reset
          </Button>
          <span className="text-sm text-zinc-500">
            status: <span className="font-mono">{deposit.status}</span>
          </span>
        </div>
        {account === null && (
          <p className="text-xs text-zinc-500">Connect an extension above to deposit.</p>
        )}
        {deposit.depositAddress && <Row label="Deposit address" value={deposit.depositAddress} />}
        {deposit.txid && <Row label="Bitcoin txid" value={deposit.txid} />}
        {deposit.error && (
          <p className="text-sm text-red-600">
            deposit error — {deposit.error.code}: {deposit.error.message}
          </p>
        )}
      </section>

      {/* Withdraw */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Withdraw sBTC → BTC
        </h2>
        <Field
          label="Amount (sats)"
          value={withdrawAmount}
          onChange={setWithdrawAmount}
          placeholder="10000"
        />
        <Field
          label="Bitcoin recipient address"
          value={withdrawTo}
          onChange={setWithdrawTo}
          placeholder="tb1q…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={account === null || Number(withdrawAmount) <= 0 || withdrawTo.trim() === ''}
            onClick={() => void withdraw.withdraw(Number(withdrawAmount), withdrawTo.trim())}
          >
            Withdraw
          </Button>
          <Button variant="subtle" onClick={() => withdraw.reset()}>
            Reset
          </Button>
          <span className="text-sm text-zinc-500">
            status: <span className="font-mono">{withdraw.status}</span>
          </span>
        </div>
        {account === null && (
          <p className="text-xs text-zinc-500">Connect an extension above to withdraw.</p>
        )}
        {withdraw.stacksTxid && <Row label="Stacks txid" value={withdraw.stacksTxid} />}
        {withdraw.btcTxid && <Row label="Bitcoin txid (released)" value={withdraw.btcTxid} />}
        {(withdraw.status === WithdrawalStatus.PENDING ||
          withdraw.status === WithdrawalStatus.CONFIRMED) && (
          <p className="text-xs text-zinc-500">
            BTC arrives in ~{withdraw.estimatedConfirmationMinutes} min (≈6 confirmations).
          </p>
        )}
        {withdraw.error && (
          <p className="text-sm text-red-600">
            withdraw error — {withdraw.error.code}: {withdraw.error.message}
          </p>
        )}
      </section>

      {/* Stacks Connect — wallet discovery */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Stacks Connect — wallet discovery
        </h2>
        <p className="text-sm text-zinc-500">
          Supported wallets the connect adapter can hand off to for PSBT / transaction signing.
        </p>
        <div>
          <Button
            onClick={() =>
              void withErr(async () => {
                setWallets(await adapter.connect.getAvailableWallets());
              })
            }
          >
            List available wallets
          </Button>
        </div>
        {wallets !== null && (
          <ul className="flex flex-col gap-1 text-sm">
            {wallets.length === 0 ? (
              <li className="text-zinc-500">None detected.</li>
            ) : (
              wallets.map((w) => (
                <li key={w.scheme} className="font-mono text-zinc-800 dark:text-zinc-200">
                  {w.name} —{' '}
                  <a className="underline" href={w.storeUrl} target="_blank" rel="noreferrer">
                    {w.storeUrl}
                  </a>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
    </main>
  );
}
