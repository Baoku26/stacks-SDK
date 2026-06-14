import { useState } from 'react';
import { View } from 'react-native';
import { useStacksWallet, useSbtcDeposit } from '@baoku26/sbtc-sdk';
import { Button, Card, ErrorText, Field, Muted, Row, Screen } from '../components/ui';

/**
 * Deposit BTC → sBTC. Account + public key come from the local wallet
 * (`useStacksWallet`, incl. `publicKey`), so nothing is pasted by hand. NOTE:
 * signing still deep-links to Leather mobile (`adapter.connect.signPsbt`), whose
 * scheme is PROVISIONAL and which signs with ITS key — a real end-to-end deposit
 * funded by the local wallet needs a `signPsbt` override that signs locally. See
 * README "Native limits".
 */
export function DepositScreen() {
  const wallet = useStacksWallet();
  const [amount, setAmount] = useState('10000');

  const deposit = useSbtcDeposit({
    stacksAddress: wallet.address ?? '',
    bitcoinAddress: wallet.btcAddress ?? '',
    paymentPublicKey: wallet.publicKey ?? '',
  });

  const ready = wallet.address !== null && wallet.publicKey !== null && Number(amount) > 0;

  return (
    <Screen>
      <Card title="Deposit BTC → sBTC">
        <Muted>
          Funds from your local wallet&apos;s Bitcoin address. The payment public key is derived
          automatically.
        </Muted>

        <Row label="Funding BTC address" value={wallet.btcAddress ?? 'Generate a wallet first'} />
        <Row label="Recipient STX address" value={wallet.address ?? '—'} />
        <Row label="Payment public key" value={wallet.publicKey ?? '—'} />

        <Field
          label="Amount (sats)"
          value={amount}
          onChangeText={setAmount}
          placeholder="10000"
          keyboardType="numeric"
        />

        <View style={{ gap: 8 }}>
          <Button title="Deposit" disabled={!ready} onPress={() => void deposit.deposit(Number(amount))} />
          <Button title="Reset" variant="subtle" onPress={() => deposit.reset()} />
        </View>

        <Row label="Status" value={deposit.status} />
        {deposit.depositAddress && <Row label="Deposit address" value={deposit.depositAddress} />}
        {deposit.txid && <Row label="Bitcoin txid" value={deposit.txid} />}
        {deposit.error && (
          <ErrorText>
            deposit error — {deposit.error.code}: {deposit.error.message}
          </ErrorText>
        )}
      </Card>
    </Screen>
  );
}
