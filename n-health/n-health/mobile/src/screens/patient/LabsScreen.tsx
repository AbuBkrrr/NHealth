import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Modal, TextInput, Pressable, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { providerApi, patientApi, LabTest } from '../../api/patient';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { PaymentModal } from '../../components/PaymentModal';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useSocket } from '../../hooks/useSocket';

interface Lab { id: string; labName: string; address?: string; distanceKm?: number; }

function defaultSlot(): Date {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Renders a lab result's freeform JSON payload as simple label/value rows. */
function ResultBody({ resultData }: { resultData: unknown }) {
  if (resultData && typeof resultData === 'object' && !Array.isArray(resultData)) {
    const entries = Object.entries(resultData as Record<string, unknown>);
    if (entries.length === 0) return <Text style={styles.resultEmpty}>No details were included with this result.</Text>;
    return (
      <>
        {entries.map(([key, value]) => (
          <View key={key} style={styles.resultRow}>
            <Text style={styles.resultKey}>{key}</Text>
            <Text style={styles.resultValue}>{String(value)}</Text>
          </View>
        ))}
      </>
    );
  }
  return <Text style={styles.resultValue}>{String(resultData)}</Text>;
}

export function LabsScreen() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [testType, setTestType] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date>(defaultSlot());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultTest, setResultTest] = useState<LabTest | null>(null);
  const [pendingTestId, setPendingTestId] = useState<string | null>(null);
  const location = useUserLocation();

  const load = useCallback(() => {
    patientApi.listLabTests().then(setTests).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocket({ 'labresult:new': load });
  useEffect(() => { providerApi.listLabs(location).then(setLabs).catch(() => {}); }, [location]);

  const openModal = () => {
    setSelectedLab(null);
    setTestType('');
    setScheduledAt(defaultSlot());
    setShowModal(true);
  };

  const onChangeDate = (_e: unknown, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) setScheduledAt((prev) => { const n = new Date(prev); n.setFullYear(date.getFullYear(), date.getMonth(), date.getDate()); return n; });
  };

  const onChangeTime = (_e: unknown, date?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (date) setScheduledAt((prev) => { const n = new Date(prev); n.setHours(date.getHours(), date.getMinutes(), 0, 0); return n; });
  };

  const submit = async () => {
    if (!selectedLab || !testType) {
      Alert.alert('Missing info', 'Choose a lab and enter the test type.');
      return;
    }
    if (scheduledAt.getTime() < Date.now()) {
      Alert.alert('Pick a future time', 'The scheduled time has already passed - choose another.');
      return;
    }
    setSubmitting(true);
    try {
      const test = await patientApi.createLabTest({ labId: selectedLab.id, testType, scheduledAt: scheduledAt.toISOString() });
      setShowModal(false);
      setPendingTestId(test.id);
      load();
    } catch (err: any) {
      Alert.alert('Request failed', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={tests}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<EmptyState icon="🧪" title="No lab tests yet" subtitle="Request a test to get started." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => item.result && setResultTest(item)} disabled={!item.result}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.title}>{item.testType}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.meta}>{item.lab.user.name}</Text>
              {item.scheduledAt ? <Text style={styles.meta}>{new Date(item.scheduledAt).toLocaleString()}</Text> : null}
              {item.result ? <Text style={styles.resultReady}>✅ Result ready · tap to view</Text> : null}
            </Card>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Button title="+ Request Lab Test" onPress={openModal} />
      </View>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request a lab test</Text>
            <FlatList
              horizontal
              data={labs}
              keyExtractor={(l) => l.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Button
                  title={item.labName}
                  variant={selectedLab?.id === item.id ? 'primary' : 'outline'}
                  onPress={() => setSelectedLab(item)}
                  style={{ marginRight: 8 }}
                />
              )}
              style={{ marginBottom: 16 }}
            />
            <TextInput style={styles.input} placeholder="Test type (e.g. Full Blood Count)" value={testType} onChangeText={setTestType} />
            <Text style={styles.feeNote}>Standard test fee: ₦5,000 (flat rate, regardless of test type)</Text>

            <Text style={styles.fieldLabel}>Preferred date & time</Text>
            <View style={styles.pickerRow}>
              <Pressable style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.pickerButtonText}>
                  {scheduledAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </Pressable>
              <Pressable style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.pickerButtonText}>
                  {scheduledAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Pressable>
            </View>
            {showDatePicker && <DateTimePicker value={scheduledAt} mode="date" minimumDate={new Date()} onChange={onChangeDate} />}
            {showTimePicker && <DateTimePicker value={scheduledAt} mode="time" onChange={onChangeTime} />}

            <Button title="Submit Request" onPress={submit} loading={submitting} style={{ marginTop: 4 }} />
            <Button title="Cancel" variant="outline" onPress={() => setShowModal(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!resultTest} animationType="slide" transparent onRequestClose={() => setResultTest(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{resultTest?.testType} result</Text>
            {resultTest?.result?.uploadedAt ? (
              <Text style={styles.meta}>Uploaded {new Date(resultTest.result.uploadedAt).toLocaleString()}</Text>
            ) : null}
            <View style={{ marginTop: 12 }}>
              {resultTest?.result ? <ResultBody resultData={resultTest.result.resultData} /> : null}
            </View>
            <Button title="Close" variant="outline" onPress={() => setResultTest(null)} style={{ marginTop: 20 }} />
          </View>
        </View>
      </Modal>

      {pendingTestId && (
        <PaymentModal
          visible={!!pendingTestId}
          payableType="LAB_TEST"
          payableId={pendingTestId}
          label="lab test"
          onConfirmed={() => load()}
          onClose={() => setPendingTestId(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  resultReady: { fontSize: 13, color: colors.success, fontWeight: '600', marginTop: 8 },
  resultEmpty: { fontSize: 14, color: colors.textSecondary },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  resultKey: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  resultValue: { fontSize: 14, color: colors.textPrimary },
  footer: { padding: 16, backgroundColor: colors.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: colors.textPrimary },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 },
  feeNote: { fontSize: 12, color: colors.textLight, marginBottom: 16, fontStyle: 'italic' },
  pickerRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  pickerButton: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 14, alignItems: 'center' },
  pickerButtonText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 14, marginBottom: 16 },
});
