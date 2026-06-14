import { useState } from 'react';
import { View } from 'react-native';
import { useStacksWallet, useSbtcContext, SbtcError, type WalletApp } from '@baoku26/sbtc-sdk';
import { Button, Card, ErrorText, Muted, Row, Screen } from '../components/ui';

export function SettingsScreen({
  network,
  onToggleNetwork,
}: {
  network: 'mainnet' | 'testnet';
  onToggleNetwork: () => void;
}) {
  const wallet = useStacksWallet();
  const { adapter } = useSbtcContext();
  const [wallets, setWallets] = useState<WalletApp[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      <Card title="Network">
        <Row label="Current network" value={network} />
        <Row label="Adapter" value={adapter.platform} />
        <Muted>
          Switching network re-mounts the SDK provider with new API endpoints. Testnet is the
          supported demo target.
        </Muted>
        <Button
          title={`Switch to ${network === 'testnet' ? 'mainnet' : 'testnet'}`}
          variant="subtle"
          onPress={onToggleNetwork}
        />
      </Card>

      <Card title="Connected wallets">
        <Muted>Leather / Xverse mobile apps detected on this device (deep-link schemes).</Muted>
        <Button
          title="Detect wallets"
          variant="subtle"
          onPress={() => void withErr(async () => setWallets(await adapter.connect.getAvailableWallets()))}
        />
        {wallets !== null &&
          (wallets.length === 0 ? (
            <Muted>None detected.</Muted>
          ) : (
            wallets.map((w) => <Row key={w.scheme} label={w.name} value={w.storeUrl} />)
          ))}
      </Card>

      <Card title="Danger zone">
        <Muted>Wipes the wallet from secure storage. Requires biometric confirmation.</Muted>
        <Button
          title="Wipe wallet"
          variant="danger"
          disabled={!wallet.isLoaded}
          onPress={() => void withErr(() => wallet.clearWallet())}
        />
        {actionError && <ErrorText>{actionError}</ErrorText>}
      </Card>
    </Screen>
  );
}
