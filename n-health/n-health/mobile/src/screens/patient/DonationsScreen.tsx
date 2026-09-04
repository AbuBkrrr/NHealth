import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { patientApi, Donation } from '../../api/patient';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { PaymentModal } from '../../components/PaymentModal';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';

const CAMPAIGNS = ['Pediatric Cancer Ward', 'Rural Clinic Fund', 'Emergency Blood Bank'];

export function DonationsScreen() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [amount, setAmount] = useState('');
  const [campaign, setCampaign] = useState(CAMPAIGNS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDonationId, setPendingDonationId] = useState<string | null>(null);

  const load = useCallback(() => {
    patientApi.listDonations().then(setDonations).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const donate = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
      return;
    }
    setSubmitting(true);
    try {
      const donation = await patientApi.createDonation({ campaign, amount: value });
      setAmount('');
      setPendingDonationId(donation.id);
    } catch (err: any) {
      Alert.alert('Donation failed', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={donations}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={
          <Card style={{ marginBottom: 20 }}>
            <Text style={styles.title}>Make a donation</Text>
            <FlatList
              horizontal
              data={CAMPAIGNS}
              keyExtractor={(c) => c}
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: 12 }}
              renderItem={({ item }) => (
                <Button
                  title={item}
                  variant={campaign === item ? 'primary' : 'outline'}
                  onPress={() => setCampaign(item)}
                  style={{ marginRight: 8 }}
                />
              )}
            />
            <TextInput style={styles.input} placeholder="Amount (₦)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            <Button title="Donate" onPress={donate} loading={submitting} />
          </Card>
        }
        ListEmptyComponent={<EmptyState icon="❤️" title="No donations yet" />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.campaign}>{item.campaign}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.amount}>₦{Number(item.amount).toLocaleString()}</Text>
            <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </Card>
        )}
        style={{ backgroundColor: colors.surface }}
      />

      {pendingDonationId && (
        <PaymentModal
          visible={!!pendingDonationId}
          payableType="DONATION"
          payableId={pendingDonationId}
          label={`donation to ${campaign}`}
          onConfirmed={() => load()}
          onClose={() => {
            setPendingDonationId(null);
            load();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  campaign: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  amount: { fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 6 },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
});
