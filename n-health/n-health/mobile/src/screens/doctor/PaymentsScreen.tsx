import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { paymentApi, Payment } from '../../api/payment';
import { Card, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { useCountdown, formatCountdown } from '../../hooks/useCountdown';
import { useSocket } from '../../hooks/useSocket';

const PAYABLE_LABEL: Record<string, string> = {
  APPOINTMENT: 'Consultation fee',
  PHARMACY_ORDER: 'Pharmacy order',
  LAB_TEST: 'Lab test fee',
  NURSE_REQUEST: 'Nurse visit fee',
  DONATION: 'Donation',
  INSURANCE_POLICY: 'Insurance premium',
};

const METHOD_LABEL: Record<string, string> = {
  USSD: '📱 USSD',
  TRANSFER: '🏦 Bank transfer',
  CARD: '💳 Card',
  WALLET: '👛 Wallet',
};

function PaymentRow({ payment, onConfirmed }: { payment: Payment; onConfirmed: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const remainingMs = useCountdown(payment.status === 'PENDING' ? payment.expiresAt : null);
  const expired = remainingMs <= 0;

  const confirm = async () => {
    setConfirming(true);
    try {
      await paymentApi.confirm(payment.id);
      onConfirmed();
    } catch (err: any) {
      Alert.alert('Could not confirm payment', getErrorMessage(err));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.payer}>{payment.payer?.name ?? 'Patient'}</Text>
        <Text style={styles.amount}>₦{Number(payment.amount).toLocaleString()}</Text>
      </View>
      <Text style={styles.meta}>{PAYABLE_LABEL[payment.payableType] ?? payment.payableType}</Text>
      <Text style={styles.meta}>{METHOD_LABEL[payment.method] ?? payment.method} · Ref: {payment.reference}</Text>
      <Text style={[styles.countdown, expired && styles.countdownExpired]}>
        {expired ? 'Window expired' : `Expires in ${formatCountdown(remainingMs)}`}
      </Text>
      <Button
        title="Confirm Payment Received"
        onPress={confirm}
        loading={confirming}
        disabled={expired}
        style={{ marginTop: 12 }}
      />
    </Card>
  );
}

export function DoctorPaymentsScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);

  const load = useCallback(() => {
    paymentApi.listIncoming().then(setPayments).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocket({ 'payment:new': load });

  return (
    <FlatList
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      data={payments}
      keyExtractor={(p) => p.id}
      ListEmptyComponent={
        <EmptyState icon="💰" title="No payments waiting" subtitle="Payments patients make to you will show up here for confirmation." />
      }
      renderItem={({ item }) => <PaymentRow payment={item} onConfirmed={load} />}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payer: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  amount: { fontSize: 16, fontWeight: '800', color: colors.doctor },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  countdown: { fontSize: 12, fontWeight: '600', color: colors.warning, marginTop: 8 },
  countdownExpired: { color: colors.error },
});
