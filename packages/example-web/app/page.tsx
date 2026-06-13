'use client';

import { useState } from 'react';
import { useStacksWallet, useSbtcContext, SbtcError, type WalletApp } from '@sbtc/sdk';

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
  variant?: 'default' | 'danger';
}) {
  const base =
    'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const styles =
    variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-500'
      : 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300';
  return (
    <button className={`${base} ${styles}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export default function Home() {
  const wallet = useStacksWallet();
  const { adapter, network } = useSbtcContext();

  const [exported, setExported] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletApp[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const busy = !wallet.isLoaded;

  async function withErr(fn: () => Promise<void>) {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof SbtcError ? `${e.code}: ${e.message}` : String(e));
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          @sbtc/sdk — Web example
        </h1>
        <p className="text-sm text-zinc-500">
          Network: <span className="font-mono">{network}</span> · adapter:{' '}
          <span className="font-mono">{adapter.platform}</span>
        </p>
      </header>

      {/* Wallet */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Wallet</h2>

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

      {/* Stacks Connect */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Stacks Connect</h2>
        <p className="text-sm text-zinc-500">
          Supported wallets the connect adapter can hand off to (signing hooks land in M5/M6).
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
