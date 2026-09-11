import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { labApi, LabTest, LabResultRow } from '../../api/lab';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors, radius } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { useSocket } from '../../hooks/useSocket';

const FILTERS: { key: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; label: string }[] = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const NEXT_ACTION: Record<string, { label: string; next: 'SAMPLE_COLLECTED' | 'PROCESSING' } | undefined> = {
  REQUESTED: { label: 'Sample Collected', next: 'SAMPLE_COLLECTED' },
  SAMPLE_COLLECTED: { label: 'Start Processing', next: 'PROCESSING' },
};

const EMPTY_ROW: LabResultRow = { parameter: '', value: '', unit: '', referenceRange: '' };

function ResultModal({ test, visible, onClose, onSaved }: { test: LabTest | null; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<LabResultRow[]>([{ ...EMPTY_ROW }]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setRows([{ ...EMPTY_ROW }]);
      setNotes('');
    }
  }, [visible, test?.id]);

  const updateRow = (idx: number, patch: Partial<LabResultRow>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    if (!test) return;
    const cleaned = rows.filter((r) => r.parameter.trim() && r.value.trim());
    if (cleaned.length === 0) {
      Alert.alert('Missing results', 'Add at least one parameter with a value.');
      return;
    }
    setSaving(true);
    try {
      await labApi.uploadResult(test.id, cleaned, notes.trim() || undefined);
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Could not save result', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Upload result{test ? ` — ${test.testType}` : ''}</Text>

            {rows.map((row, idx) => (
              <View key={idx} style={styles.resultRow}>
                <TextInput style={styles.input} placeholder="Parameter (e.g. Hemoglobin)" value={row.parameter} onChangeText={(v) => updateRow(idx, { parameter: v })} />
                <View style={styles.resultRowInline}>
                  <TextInput style={[styles.input, styles.flex1, { marginRight: 8 }]} placeholder="Value" value={row.value} onChangeText={(v) => updateRow(idx, { value: v })} />
                  <TextInput style={[styles.input, styles.flex1]} placeholder="Unit" value={row.unit} onChangeText={(v) => updateRow(idx, { unit: v })} />
                </View>
                <TextInput style={styles.input} placeholder="Reference range (optional)" value={row.referenceRange} onChangeText={(v) => updateRow(idx, { referenceRange: v })} />
              </View>
            ))}

            <Pressable onPress={() => setRows((r) => [...r, { ...EMPTY_ROW }])}>
              <Text style={styles.addRowLink}>+ Add another parameter</Text>
            </Pressable>

            <Text style={styles.label}>Notes for the doctor (optional)</Text>
            <TextInput style={[styles.input, { height: 70 }]} multiline value={notes} onChangeText={setNotes} placeholder="Any observations..." />

            <Button title="Save & Complete Test" onPress={save} loading={saving} style={{ marginTop: 16 }} />
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TestRow({ test, onChanged, onUploadResult }: { test: LabTest; onChanged: () => void; onUploadResult: () => void }) {
  const [acting, setActing] = useState(false);
  const action = NEXT_ACTION[test.status];
  const canCancel = test.status !== 'COMPLETED' && test.status !== 'CANCELLED';

  const setStatus = async (status: 'SAMPLE_COLLECTED' | 'PROCESSING' | 'CANCELLED') => {
    setActing(true);
    try {
      await labApi.updateTestStatus(test.id, status);
      onChanged();
    } catch (err: any) {
      Alert.alert('Could not update test', getErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const cancel = () => {
    Alert.alert('Cancel test', 'Cancel this test request?', [
      { text: 'Keep test', style: 'cancel' },
      { text: 'Cancel test', style: 'destructive', onPress: () => setStatus('CANCELLED') },
    ]);
  };

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.patient}>{test.patient.user.name}</Text>
        <StatusBadge status={test.status} />
      </View>
      <Text style={styles.meta}>{test.testType} · ₦{Number(test.fee).toLocaleString()}</Text>
      <View style={styles.row}>
        <Text style={styles.dateMeta}>{new Date(test.createdAt).toLocaleDateString()}</Text>
        <Text style={[styles.paymentTag, test.isPaid ? styles.paid : styles.unpaid]}>
          {test.isPaid ? 'Paid' : 'Awaiting payment'}
        </Text>
      </View>

      {test.status === 'PROCESSING' && (
        <Button title="Upload Result" onPress={onUploadResult} style={{ marginTop: 12 }} />
      )}

      {action && (
        <View style={styles.actionsRow}>
          <Button
            title={action.label}
            onPress={() => setStatus(action.next)}
            loading={acting}
            disabled={!test.isPaid}
            style={{ flex: 1, marginRight: canCancel ? 8 : 0 }}
          />
          {canCancel && <Button title="Cancel" variant="outline" onPress={cancel} loading={acting} style={{ flex: 1 }} />}
        </View>
      )}
      {action && !test.isPaid && (
        <Text style={styles.waitingNote}>Waiting for the patient's payment to be confirmed.</Text>
      )}
    </Card>
  );
}

export function LabTestsScreen() {
  const [filter, setFilter] = useState<'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ACTIVE');
  const [tests, setTests] = useState<LabTest[]>([]);
  const [resultModalTest, setResultModalTest] = useState<LabTest | null>(null);

  const load = useCallback(() => {
    const status = filter === 'ACTIVE' ? undefined : filter;
    labApi.listTests(status).then(setTests).catch(() => {});
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocket({ 'payment:confirmed': load, 'labtest:updated': load });

  const shown = filter === 'ACTIVE'
    ? tests.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
    : tests;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={styles.tabs}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} style={[styles.tab, filter === f.key && styles.tabActive]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.tabText, filter === f.key && styles.tabTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        data={shown}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<EmptyState icon="🧪" title="No tests here" />}
        renderItem={({ item }) => (
          <TestRow test={item} onChanged={load} onUploadResult={() => setResultModalTest(item)} />
        )}
      />

      <ResultModal
        test={resultModalTest}
        visible={resultModalTest !== null}
        onClose={() => setResultModalTest(null)}
        onSaved={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.white, padding: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: colors.labLight },
  tabText: { fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.lab },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  patient: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 8 },
  dateMeta: { fontSize: 12, color: colors.textLight },
  paymentTag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  paid: { color: colors.success, backgroundColor: colors.success + '22' },
  unpaid: { color: colors.warning, backgroundColor: colors.warning + '22' },
  actionsRow: { flexDirection: 'row', marginTop: 12 },
  waitingNote: { fontSize: 12, color: colors.textLight, marginTop: 8, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: 20, maxHeight: '88%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 8 },
  resultRow: { borderWidth: 1, borderColor: '#EEE', borderRadius: radius.sm, padding: 10, marginBottom: 10, backgroundColor: colors.surface },
  resultRowInline: { flexDirection: 'row' },
  flex1: { flex: 1 },
  addRowLink: { fontSize: 14, fontWeight: '600', color: colors.lab, marginBottom: 12 },
});
