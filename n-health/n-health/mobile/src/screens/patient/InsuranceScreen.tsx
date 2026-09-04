import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { patientApi, InsurancePolicy } from '../../api/patient';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { PaymentModal } from '../../components/PaymentModal';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';

export function InsuranceScreen() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [provider, setProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [coverage, setCoverage] = useState('');
  const [premium, setPremium] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payingPolicy, setPayingPolicy] = useState<InsurancePolicy | null>(null);

  const load = useCallback(() => {
    patientApi.listInsurance().then(setPolicies).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!provider || !policyNumber) {
      Alert.alert('Missing info', 'Enter both provider and policy number.');
      return;
    }
    setSubmitting(true);
    try {
      await patientApi.addInsurance({
        provider,
        policyNumber,
        coverageDetails: coverage,
        premiumAmount: premium ? Number(premium) : undefined,
      });
      setShowModal(false);
      setProvider('');
      setPolicyNumber('');
      setCoverage('');
      setPremium('');
      load();
    } catch (err: any) {
      Alert.alert('Could not add policy', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={policies}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={<EmptyState icon="📋" title="No insurance policies on file" />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.provider}>{item.provider}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.meta}>Policy #{item.policyNumber}</Text>
            {item.coverageDetails ? <Text style={styles.coverage}>{item.coverageDetails}</Text> : null}
            {item.premiumAmount ? (
              <>
                <Text style={styles.premium}>Premium: ₦{Number(item.premiumAmount).toLocaleString()}</Text>
                <Button title="Pay Premium" onPress={() => setPayingPolicy(item)} style={{ marginTop: 10 }} />
              </>
            ) : null}
          </Card>
        )}
      />
      <View style={styles.footer}>
        <Button title="+ Add Insurance Policy" onPress={() => setShowModal(true)} />
      </View>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add insurance policy</Text>
            <TextInput style={styles.input} placeholder="Provider (e.g. AXA Mansard)" value={provider} onChangeText={setProvider} />
            <TextInput style={styles.input} placeholder="Policy number" value={policyNumber} onChangeText={setPolicyNumber} />
            <TextInput style={styles.input} placeholder="Coverage details (optional)" value={coverage} onChangeText={setCoverage} multiline />
            <TextInput
              style={styles.input}
              placeholder="Premium amount, ₦ (optional)"
              keyboardType="numeric"
              value={premium}
              onChangeText={setPremium}
            />
            <Button title="Save Policy" onPress={submit} loading={submitting} />
            <Button title="Cancel" variant="outline" onPress={() => setShowModal(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>

      {payingPolicy && (
        <PaymentModal
          visible={!!payingPolicy}
          payableType="INSURANCE_POLICY"
          payableId={payingPolicy.id}
          label={`${payingPolicy.provider} premium`}
          onConfirmed={() => load()}
          onClose={() => setPayingPolicy(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  provider: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  coverage: { fontSize: 14, color: colors.textPrimary, marginTop: 8 },
  premium: { fontSize: 14, fontWeight: '600', color: colors.primary, marginTop: 8 },
  footer: { padding: 16, backgroundColor: colors.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 14, marginBottom: 12 },
});
