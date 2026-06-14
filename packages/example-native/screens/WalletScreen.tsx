import { useState } from 'react';
import { View } from 'react-native';
import { useStacksWallet, useSbtcBalance, useStxBalance, SbtcError } from '@sbtc/sdk';
import { Button, Card, ErrorText, Muted, Row, Screen } from '../components/ui';

export function WalletScreen() {
  const wallet = useStacksWallet();
  const sbtc = useSbtcBalance(wallet.address);
  const stx = useStxBalance(wallet.address);

  const [exported, setExported] = useState<string | null>(null);
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
    <Screen>
      <Card title="Local wallet">
        <Muted>
          Self-custodial wallet the SDK generates and stores in the device Secure Enclave
          (expo-secure-store). Sensitive actions gate on biometrics.
        </Muted>

        {!wallet.isLoaded ? (
          <Muted>Loading…</Muted>
        ) : wallet.address === null ? (
          <Muted>{wallet.isLocked ? 'Wallet locked.' : 'No wallet yet.'}</Muted>
        ) : (
          <View style={{ gap: 10 }}>
            <Row label="Stacks address" value={wallet.address} />
            <Row label="Bitcoin address" value={wallet.btcAddress ?? '—'} />
          </View>
        )}

        <View style={{ gap: 8 }}>
          <Button title="Generate" disabled={busy} onPress={() => void withErr(() => wallet.generateWallet())} />
          <Button
            title="Lock"
            variant="subtle"
            disabled={busy || wallet.address === null}
            onPress={() => wallet.lockWallet()}
          />
          <Button
            title="Export mnemonic (biometric)"
            variant="subtle"
            disabled={busy}
            onPress={() => void withErr(async () => setExported(await wallet.exportMnemonic()))}
          />
          <Button
            title="Clear wallet (biometric)"
            variant="danger"
            disabled={busy}
            onPress={() =>
              void withErr(async () => {
                await wallet.clearWallet();
                setExported(null);
              })
            }
          />
        </View>

        {exported !== null && (
          <View style={{ gap: 6 }}>
            <Row label="Exported mnemonic (keep secret)" value={exported} />
            <Button title="Hide" variant="subtle" onPress={() => setExported(null)} />
          </View>
        )}

        {wallet.error && (
          <ErrorText>
            wallet error — {wallet.error.code}: {wallet.error.message}
          </ErrorText>
        )}
        {actionError && <ErrorText>{actionError}</ErrorText>}
      </Card>

      <Card title="Balances">
        {wallet.address === null ? (
          <Muted>Generate a wallet to see balances.</Muted>
        ) : (
          <View style={{ gap: 10 }}>
            <Row label="sBTC" value={sbtc.isLoading ? 'Loading…' : (sbtc.btc ?? '—')} />
            <Row label="STX" value={stx.isLoading ? 'Loading…' : (stx.stx ?? '—')} />
            <Button
              title={sbtc.isRefreshing || stx.isRefreshing ? 'Refreshing…' : 'Refresh'}
              variant="subtle"
              disabled={sbtc.isRefreshing || stx.isRefreshing}
              onPress={() => {
                sbtc.refresh();
                stx.refresh();
              }}
            />
          </View>
        )}
        {(sbtc.error || stx.error) && (
          <ErrorText>
            balance error — {(sbtc.error ?? stx.error)?.code}: {(sbtc.error ?? stx.error)?.message}
          </ErrorText>
        )}
      </Card>
    </Screen>
  );
}
