import { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SbtcProvider, NativeAdapter } from '@sbtc/sdk';
import { colors } from './components/ui';
import { WalletScreen } from './screens/WalletScreen';
import { DepositScreen } from './screens/DepositScreen';
import { WithdrawScreen } from './screens/WithdrawScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Tab = 'wallet' | 'deposit' | 'withdraw' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'wallet', label: 'Wallet' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'withdraw', label: 'Withdraw' },
  { key: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('wallet');
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('testnet');

  // Construct the NativeAdapter explicitly so we can set the deep-link callback
  // scheme (must match `scheme` in app.json). Rebuilt when the network changes so
  // the provider re-mounts with a fresh adapter.
  const adapter = useMemo(() => new NativeAdapter({ callbackScheme: 'sbtcsdk' }), [network]);

  return (
    <SbtcProvider key={network} network={network} adapter={adapter}>
      <SafeAreaView style={styles.app}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.title}>@sbtc/sdk — Native example</Text>
          <Text style={styles.subtitle}>{network}</Text>
        </View>

        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.body}>
          {tab === 'wallet' && <WalletScreen />}
          {tab === 'deposit' && <DepositScreen />}
          {tab === 'withdraw' && <WithdrawScreen />}
          {tab === 'settings' && (
            <SettingsScreen
              network={network}
              onToggleNetwork={() =>
                setNetwork((n) => (n === 'testnet' ? 'mainnet' : 'testnet'))
              }
            />
          )}
        </View>
      </SafeAreaView>
    </SbtcProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 2 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 12, fontFamily: 'Courier' },
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.accentText },
  body: { flex: 1 },
});
