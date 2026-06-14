import { useState } from 'react';
import { View } from 'react-native';
import { useStacksWallet, useSbtcWithdraw, WithdrawalStatus } from '@sbtc/sdk';
import { Button, Card, ErrorText, Field, Muted, Row, Screen } from '../components/ui';

/**
 * Withdraw sBTC → BTC. Account + Stacks public key come from the local wallet
 * (`useStacksWallet.publicKey`) — no manual entry. Signs the Stacks
 * `initiate-withdrawal-request` via the deep-link connect adapter (same signing
 * caveat as deposit — see README).
 */
export function WithdrawScreen() {
  const wallet = useStacksWallet();
  const [amount, setAmount] = useState('10000');
  const [recipient, setRecipient] = useState('');

  const withdraw = useSbtcWithdraw({
    stacksAddress: wallet.address ?? '',
    stacksPublicKey: wallet.publicKey ?? '',
  });

  const ready =
    wallet.address !== null &&
    wallet.publicKey !== null &&
    Number(amount) > 0 &&
    recipient.trim() !== '';

  const inFlight =
    withdraw.status === WithdrawalStatus.PENDING || withdraw.status === WithdrawalStatus.CONFIRMED;

  return (
    <Screen>
      <Card title="Withdraw sBTC → BTC">
        <Muted>
          Burns sBTC from your local wallet&apos;s Stacks account and releases BTC to the recipient.
          The Stacks public key is derived automatically.
        </Muted>

        <Row label="Sender STX address" value={wallet.address ?? 'Generate a wallet first'} />
        <Row label="Stacks public key" value={wallet.publicKey ?? '—'} />

        <Field
          label="Amount (sats)"
          value={amount}
          onChangeText={setAmount}
          placeholder="10000"
          keyboardType="numeric"
        />
        <Field
          label="Bitcoin recipient address"
          value={recipient}
          onChangeText={setRecipient}
          placeholder="tb1q…"
        />

        <View style={{ gap: 8 }}>
          <Button
            title="Withdraw"
            disabled={!ready}
            onPress={() => void withdraw.withdraw(Number(amount), recipient.trim())}
          />
          <Button title="Reset" variant="subtle" onPress={() => withdraw.reset()} />
        </View>

        <Row label="Status" value={withdraw.status} />
        {withdraw.stacksTxid && <Row label="Stacks txid" value={withdraw.stacksTxid} />}
        {withdraw.btcTxid && <Row label="Bitcoin txid (released)" value={withdraw.btcTxid} />}
        {inFlight && (
          <Muted>
            BTC arrives in ~{withdraw.estimatedConfirmationMinutes} min (≈6 confirmations).
          </Muted>
        )}
        {withdraw.error && (
          <ErrorText>
            withdraw error — {withdraw.error.code}: {withdraw.error.message}
          </ErrorText>
        )}
      </Card>
    </Screen>
  );
}
