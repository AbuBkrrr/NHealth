import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Alert, Linking } from 'react-native';
import { paymentApi, Payment, PayableType, WEB_APP_URL } from '../api/payment';
import { Button } from './Button';
import { colors, radius } from '../theme/colors';
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

const ESCROW_PURPOSE: Partial<Record<PayableType, string>> = { APPOINTMENT: 'appointment', PHARMACY_ORDER: 'pharmacy', LAB_TEST: 'lab', NURSE_REQUEST: 'nurse' };

type Choice = 'WALLET' | 'CARD' | 'CASH' | 'ESCROW';
type Stage = 'SELECT' | 'CASH_PENDING' | 'ESCROW_OPENED' | 'CARD_OPENED' | 'SUCCESS' | 'CANCELLED';

/**
 * Payment sheet. Options:
 *  - N-Health coins (instant; top up in the web app by card / transfer / USSD through Paystack or Flutterwave)
 *  - Cash to the provider (provider confirms receipt; commission is handled on their earnings balance)
 *  - Escrow via PayScrow (card/transfer checkout; funds released to the provider after service)
 */
export function PaymentModal({ visible, payableType, payableId, label, onClose, onConfirmed }: Props) {
  const [stage, setStage] = useState<Stage>('SELECT');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [cfg, setCfg] = useState<{ cashEnabled?: boolean; escrow?: boolean; gateways?: string[] }>({});

  const providerService = !!ESCROW_PURPOSE[payableType];
  const options: { key: Choice; label: string; icon: string; note: string; enabled: boolean }[] = [
    { key: 'WALLET', label: 'N-Health Coins', icon: '🪙', note: balance === null ? 'Checking balance…' : `Balance: ${balance.toLocaleString()} coins`, enabled: true },
    ...(providerService && (cfg.gateways || []).some((g) => g === 'paystack' || g === 'flutterwave') ? [{ key: 'CARD' as Choice, label: 'Card / Transfer / USSD', icon: '💳', note: 'Paid straight to the provider', enabled: true }] : []),
    ...(providerService && cfg.cashEnabled ? [{ key: 'CASH' as Choice, label: 'Cash to provider', icon: '💵', note: 'Pay in person; the provider confirms receipt', enabled: true }] : []),
    ...(providerService && cfg.escrow ? [{ key: 'ESCROW' as Choice, label: 'Escrow (card / transfer)', icon: '🔒', note: 'Held safely until the service is done', enabled: true }] : []),
  ];

  useEffect(() => {
    if (!visible) return;
    setStage('SELECT');
    setChoice(null);
    setPayment(null);
    paymentApi.balance().then(setBalance).catch(() => setBalance(0));
    paymentApi.config().then(setCfg).catch(() => setCfg({}));
  }, [visible, payableId]);

  // Cash: the provider confirms receipt in their app.
  useSocket({
    'payment:confirmed': (updated: Payment) => {
      if (payment && updated.id === payment.id) {
        setPayment(updated);
        setStage('SUCCESS');
        onConfirmed?.(updated);
      }
    },
  });
  useEffect(() => {
    if (stage !== 'CASH_PENDING' || !payment) return;
    const t = setInterval(async () => {
      try {
        const latest = await paymentApi.get(payment.id);
        if (latest.status === 'CONFIRMED') { setPayment(latest); setStage('SUCCESS'); onConfirmed?.(latest); }
        if (latest.status === 'CANCELLED' || latest.status === 'EXPIRED') setStage('CANCELLED');
      } catch { /* next poll */ }
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, payment?.id]);

  const topUp = () => Linking.openURL(`${WEB_APP_URL}/#/patient/wallet`);

  const proceed = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      if (choice === 'WALLET') {
        const created = await paymentApi.create(payableType, payableId, 'WALLET');
        setPayment(created);
        setStage('SUCCESS');
        onConfirmed?.(created);
      } else if (choice === 'CARD') {
        const r = await paymentApi.card(payableType, payableId);
        if (r.checkoutUrl) await Linking.openURL(r.checkoutUrl);
        setStage('CARD_OPENED');
      } else if (choice === 'CASH') {
        const created = await paymentApi.create(payableType, payableId, 'CASH');
        setPayment(created);
        setStage('CASH_PENDING');
      } else {
        const r = await paymentApi.escrow(ESCROW_PURPOSE[payableType]!, payableId, label);
        if (r.paymentLink) await Linking.openURL(r.paymentLink);
        setStage('ESCROW_OPENED');
      }
    } catch (err: any) {
      const msg = getErrorMessage(err);
      if (/insufficient coins/i.test(msg)) {
        Alert.alert('Not enough coins', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Top up', onPress: topUp }]);
      } else {
        Alert.alert('Could not complete payment', msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelCash = async () => {
    if (!payment) return;
    setBusy(true);
    try { await paymentApi.cancel(payment.id); setStage('CANCELLED'); }
    catch (err: any) { Alert.alert('Could not cancel', getErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView style={styles.card} contentContainerStyle={{ paddingBottom: 24 }}>
          {stage === 'SELECT' && (
            <>
              <Text style={styles.title}>Pay {label}</Text>
              <Text style={styles.subtitle}>Choose how you'd like to pay</Text>
              {options.map((m) => (
                <Pressable key={m.key} disabled={!m.enabled} onPress={() => setChoice(m.key)} style={[styles.methodRow, choice === m.key && styles.methodRowActive, !m.enabled && styles.methodRowDisabled]}>
                  <Text style={styles.methodIcon}>{m.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodLabel}>{m.label}</Text>
                    <Text style={styles.methodLockedNote}>{m.note}</Text>
                  </View>
                  {choice === m.key && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              ))}
              <Pressable onPress={topUp}><Text style={[styles.copyLink, { textAlign: 'center', marginTop: 6 }]}>+ Top up coins (card, transfer or USSD)</Text></Pressable>
              <Button title="Pay now" onPress={proceed} loading={busy} disabled={!choice} style={{ marginTop: 20 }} />
              <Button title="Pay later" variant="outline" onPress={onClose} style={{ marginTop: 10 }} />
            </>
          )}

          {stage === 'CASH_PENDING' && payment && (
            <View style={styles.centered}>
              <Text style={styles.bigIcon}>💵</Text>
              <Text style={styles.title}>Pay ₦{Number(payment.amount).toLocaleString()} in cash</Text>
              <Text style={styles.subtitle}>Hand the cash to your provider. This screen updates when they confirm they received it.</Text>
              <Button title="Done" onPress={onClose} style={{ marginTop: 10, width: '100%' }} />
              <Button title="Cancel cash payment" variant="outline" onPress={cancelCash} loading={busy} style={{ marginTop: 10, width: '100%' }} />
            </View>
          )}

          {stage === 'ESCROW_OPENED' && (
            <View style={styles.centered}>
              <Text style={styles.bigIcon}>🔒</Text>
              <Text style={styles.title}>Complete payment in the browser</Text>
              <Text style={styles.subtitle}>Your money is held in escrow and released to the provider after your service. You'll be notified when payment is received.</Text>
              <Button title="Done" onPress={onClose} style={{ marginTop: 10, width: '100%' }} />
            </View>
          )}

          {stage === 'CARD_OPENED' && (
            <View style={styles.centered}>
              <Text style={styles.bigIcon}>💳</Text>
              <Text style={styles.title}>Complete payment in the browser</Text>
              <Text style={styles.subtitle}>Once your bank confirms, the booking is marked paid and you'll get a notification.</Text>
              <Button title="Done" onPress={onClose} style={{ marginTop: 10, width: '100%' }} />
            </View>
          )}

          {stage === 'SUCCESS' && (
            <View style={styles.centered}>
              <Text style={styles.bigIcon}>✅</Text>
              <Text style={styles.title}>Payment confirmed</Text>
              <Text style={styles.subtitle}>Your payment has been received and confirmed.</Text>
              {payment && (
                <Button title="Download Receipt" variant="outline" onPress={() => downloadAndSharePdf(`/payments/${payment.id}/receipt.pdf`, `receipt-${payment.reference}.pdf`)} style={{ marginTop: 12, width: '100%' }} />
              )}
              <Button title="Done" onPress={onClose} style={{ marginTop: 10, width: '100%' }} />
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
