import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Alert, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { paymentApi, Payment, PayableType, PaymentMethod } from '../api/payment';
import { Button } from './Button';
import { colors, radius } from '../theme/colors';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { useSocket } from '../hooks/useSocket';
import { getErrorMessage } from '../utils/errorMessage';
import { downloadAndSharePdf } from '../utils/downloadPdf';

interface Props {
  visible: boolean;
  payableType: PayableType;
  payableId: string;
  label: string;
  onClose: () => void;
  /** Called once the payment reaches a final CONFIRMED state. */
  onConfirmed?: (payment: Payment) => void;
}

const METHODS: { key: PaymentMethod; label: string; icon: string; enabled: boolean }[] = [
  { key: 'USSD', label: 'USSD', icon: '📱', enabled: true },
  { key: 'TRANSFER', label: 'Bank Transfer', icon: '🏦', enabled: true },
  { key: 'CARD', label: 'Debit/Credit Card', icon: '💳', enabled: true },
  { key: 'WALLET', label: 'N-Health Wallet', icon: '👛', enabled: false },
];

type Stage = 'SELECT' | 'AWAITING' | 'SUCCESS' | 'EXPIRED' | 'CANCELLED';

export function PaymentModal({ visible, payableType, payableId, label, onClose, onConfirmed }: Props) {
  const [stage, setStage] = useState<Stage>('SELECT');
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const remainingMs = useCountdown(payment?.status === 'PENDING' ? payment.expiresAt : null);

  // Reset to a clean slate every time the modal is (re)opened for a new payable.
  useEffect(() => {
    if (visible) {
      setStage('SELECT');
      setMethod(null);
      setPayment(null);
    }
  }, [visible, payableId]);

  // Live push from the provider confirming - falls back to the countdown/expiry
  // logic below if the socket message is missed for any reason.
  useSocket({
    'payment:confirmed': (updated: Payment) => {
      if (payment && updated.id === payment.id) {
        setPayment(updated);
        setStage('SUCCESS');
        onConfirmed?.(updated);
      }
    },
  });

  // Fallback poll in case the socket event doesn't arrive.
  useEffect(() => {
    if (stage !== 'AWAITING' || !payment) return;
    const interval = setInterval(async () => {
      try {
        const latest = await paymentApi.get(payment.id);
        setPayment(latest);
        if (latest.status === 'CONFIRMED') {
          setStage('SUCCESS');
          onConfirmed?.(latest);
        } else if (latest.status === 'EXPIRED') {
          setStage('EXPIRED');
        }
      } catch {
        // Ignore transient poll failures - the socket or the next poll will catch up.
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, payment?.id]);

  // Countdown hit zero client-side - flip to expired without waiting for the next poll.
  useEffect(() => {
    if (stage === 'AWAITING' && remainingMs <= 0) {
      setStage('EXPIRED');
    }
  }, [stage, remainingMs]);

  const proceed = async () => {
    if (!method) return;
    setCreating(true);
    try {
      const created = await paymentApi.create(payableType, payableId, method);
      setPayment(created);
      if (created.status === 'CONFIRMED') {
        setStage('SUCCESS');
        onConfirmed?.(created);
      } else {
        setStage('AWAITING');
      }
    } catch (err: any) {
      Alert.alert('Could not start payment', getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const cancel = async () => {
    if (!payment) return;
    setCancelling(true);
    try {
      await paymentApi.cancel(payment.id);
      setStage('CANCELLED');
    } catch (err: any) {
      Alert.alert('Could not cancel', getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const copy = async (value: string, what: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', `${what} copied to clipboard.`);
  };

  const tryAgain = () => {
    setStage('SELECT');
    setMethod(null);
    setPayment(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView style={styles.card} contentContainerStyle={{ paddingBottom: 24 }}>
          {stage === 'SELECT' && (
            <>
              <Text style={styles.title}>Pay {label}</Text>
              <Text style={styles.subtitle}>Choose how you'd like to pay</Text>

              {METHODS.map((m) => (
                <Pressable
                  key={m.key}
                  disabled={!m.enabled}
                  onPress={() => setMethod(m.key)}
                  style={[
                    styles.methodRow,
                    method === m.key && styles.methodRowActive,
                    !m.enabled && styles.methodRowDisabled,
                  ]}
                >
                  <Text style={styles.methodIcon}>{m.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.methodLabel, !m.enabled && styles.methodLabelDisabled]}>{m.label}</Text>
                    {!m.enabled && <Text style={styles.methodLockedNote}>🔒 Coming soon - pending license approval</Text>}
                  </View>
                  {method === m.key && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              ))}

              <Button title="Proceed to Pay" onPress={proceed} loading={creating} disabled={!method} style={{ marginTop: 20 }} />
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ marginTop: 10 }} />
            </>
          )}

          {stage === 'AWAITING' && payment && (
            <>
              <Text style={styles.title}>Complete your payment</Text>
              <View style={styles.timerBox}>
                <Text style={styles.timerLabel}>Time remaining</Text>
                <Text style={styles.timerValue}>{formatCountdown(remainingMs)}</Text>
              </View>

              <Text style={styles.amount}>₦{Number(payment.amount).toLocaleString()}</Text>

              {payment.method === 'USSD' && (
                <View style={styles.instructionBox}>
                  <Text style={styles.instructionLabel}>Dial this USSD code</Text>
                  <Text style={styles.instructionValue}>{payment.ussdCode}</Text>
                  <View style={styles.instructionActions}>
                    <Button
                      title="📞 Dial"
                      onPress={() => Linking.openURL(`tel:${encodeURIComponent(payment.ussdCode ?? '')}`)}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button title="Copy" variant="outline" onPress={() => copy(payment.ussdCode ?? '', 'USSD code')} style={{ flex: 1 }} />
                  </View>
                </View>
              )}

              {payment.method === 'TRANSFER' && (
                <View style={styles.instructionBox}>
                  <Text style={styles.instructionLabel}>Transfer to</Text>
                  <Text style={styles.instructionValue}>{payment.transferBankName}</Text>
                  <Text style={styles.instructionValue}>{payment.transferAccountName}</Text>
                  <View style={styles.row}>
                    <Text style={styles.instructionValueBold}>{payment.transferAccountNumber}</Text>
                    <Pressable onPress={() => copy(payment.transferAccountNumber ?? '', 'Account number')}>
                      <Text style={styles.copyLink}>Copy</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.instructionLabel}>Reference (include in narration)</Text>
                  <View style={styles.row}>
                    <Text style={styles.instructionValueBold}>{payment.reference}</Text>
                    <Pressable onPress={() => copy(payment.reference, 'Reference')}>
                      <Text style={styles.copyLink}>Copy</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {payment.method === 'CARD' && (
                <View style={styles.instructionBox}>
                  <Text style={styles.instructionLabel}>Card payment</Text>
                  <Text style={styles.demoNote}>
                    Demo mode - no real card is charged here. In production this connects to a licensed payment
                    gateway (e.g. Paystack/Flutterwave), which confirms instantly instead of waiting on a manual
                    check.
                  </Text>
                </View>
              )}

              <Text style={styles.waitingNote}>Waiting for the provider to confirm they've received your payment...</Text>

              <Button title="Cancel Payment" variant="outline" onPress={cancel} loading={cancelling} style={{ marginTop: 16 }} />
            </>
          )}

          {stage === 'SUCCESS' && (
            <View style={styles.centered}>
              <Text style={styles.bigIcon}>✅</Text>
              <Text style={styles.title}>Payment confirmed</Text>
              <Text style={styles.subtitle}>Your payment has been received and confirmed.</Text>
              {payment && (
                <Button
                  title="Download Receipt"
                  variant="outline"
                  onPress={() => downloadAndSharePdf(`/payments/${payment.id}/receipt.pdf`, `receipt-${payment.reference}.pdf`)}
                  style={{ marginTop: 12, width: '100%' }}
                />
              )}
              <Button title="Done" onPress={onClose} style={{ marginTop: 10, width: '100%' }} />
            </View>
          )}

          {stage === 'EXPIRED' && (
            <View style={styles.centered}>
              <Text style={styles.bigIcon}>⏰</Text>
              <Text style={styles.title}>Payment window expired</Text>
              <Text style={styles.subtitle}>You didn't complete the payment within 5 minutes.</Text>
              <Button title="Try Again" onPress={tryAgain} style={{ marginTop: 20, width: '100%' }} />
              <Button title="Close" variant="outline" onPress={onClose} style={{ marginTop: 10, width: '100%' }} />
            </View>
          )}

          {stage === 'CANCELLED' && (
            <View style={styles.centered}>
              <Text style={styles.bigIcon}>✕</Text>
              <Text style={styles.title}>Payment cancelled</Text>
              <Button title="Close" variant="outline" onPress={onClose} style={{ marginTop: 20, width: '100%' }} />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 6, marginBottom: 16 },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 10,
  },
  methodRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  methodRowDisabled: { opacity: 0.5, backgroundColor: '#FAFAFA' },
  methodIcon: { fontSize: 22, marginRight: 12 },
  methodLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  methodLabelDisabled: { color: colors.textLight },
  methodLockedNote: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  checkmark: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  timerBox: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, padding: 16, alignItems: 'center', marginBottom: 16 },
  timerLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  timerValue: { fontSize: 32, fontWeight: '800', color: colors.primary, marginTop: 4 },
  amount: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 16 },
  instructionBox: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: 16, marginBottom: 16 },
  instructionLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginTop: 8 },
  instructionValue: { fontSize: 15, color: colors.textPrimary, marginTop: 2 },
  instructionValueBold: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  instructionActions: { flexDirection: 'row', marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  copyLink: { color: colors.primary, fontWeight: '600' },
  demoNote: { fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 18 },
  waitingNote: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic' },
  centered: { alignItems: 'center', paddingVertical: 20 },
  bigIcon: { fontSize: 48, marginBottom: 12 },
});
