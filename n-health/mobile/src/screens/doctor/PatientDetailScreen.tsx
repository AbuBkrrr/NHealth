import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TextInput, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { doctorApi, PatientDetail, Medication } from '../../api/doctor';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors, radius } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { downloadAndSharePdf } from '../../utils/downloadPdf';

const emptyMed = (): Medication => ({ name: '', dosage: '', frequency: '', durationDays: 7 });

export function PatientDetailScreen({ route, navigation }: any) {
  const { patientId, patientName } = route.params;
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [meds, setMeds] = useState<Medication[]>([emptyMed()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: patientName });
  }, [navigation, patientName]);

  const load = useCallback(() => {
    doctorApi.getPatientDetail(patientId).then(setDetail).catch(() => {});
  }, [patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateMed = (index: number, field: keyof Medication, value: string) => {
    setMeds((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: field === 'durationDays' ? Number(value) || 0 : value } : m))
    );
  };

  const addMedRow = () => setMeds((prev) => [...prev, emptyMed()]);
  const removeMedRow = (index: number) => setMeds((prev) => prev.filter((_, i) => i !== index));

  const submitPrescription = async () => {
    const valid = meds.every((m) => m.name && m.dosage && m.frequency && m.durationDays > 0);
    if (!valid) {
      Alert.alert('Missing info', 'Fill in every field for each medication (or remove the row).');
      return;
    }
    setSubmitting(true);
    try {
      await doctorApi.createPrescription(patientId, meds);
      setShowModal(false);
      setMeds([emptyMed()]);
      load();
    } catch (err: any) {
      Alert.alert('Could not save prescription', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!detail) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Card>
          <Text style={styles.sectionTitle}>Patient info</Text>
          {detail.patient.bloodType ? <Text style={styles.meta}>Blood type: {detail.patient.bloodType}</Text> : null}
          {detail.patient.allergies ? <Text style={styles.meta}>Allergies: {detail.patient.allergies}</Text> : null}
          {detail.patient.address ? <Text style={styles.meta}>Address: {detail.patient.address}</Text> : null}
          {detail.patient.emergencyContact ? (
            <Text style={styles.meta}>
              Emergency contact: {detail.patient.emergencyContact} {detail.patient.emergencyPhone ? `(${detail.patient.emergencyPhone})` : ''}
            </Text>
          ) : null}
        </Card>

        <Text style={styles.sectionHeader}>Appointment history</Text>
        {detail.appointments.length === 0 ? (
          <EmptyState icon="🩺" title="No appointments yet" />
        ) : (
          detail.appointments.map((a) => (
            <Card key={a.id}>
              <View style={styles.row}>
                <Text style={styles.meta}>{new Date(a.scheduledAt).toLocaleString()}</Text>
                <StatusBadge status={a.status} />
              </View>
              {a.reason ? <Text style={styles.reason}>{a.reason}</Text> : null}
            </Card>
          ))
        )}

        <Text style={styles.sectionHeader}>Prescriptions</Text>
        {detail.prescriptions.length === 0 ? (
          <EmptyState icon="📝" title="No prescriptions issued yet" />
        ) : (
          detail.prescriptions.map((p) => (
            <Card key={p.id}>
              <Text style={styles.meta}>{new Date(p.issuedAt).toLocaleDateString()}</Text>
              {p.medications.map((m, i) => (
                <Text key={i} style={styles.medLine}>
                  {m.name} — {m.dosage}, {m.frequency}, {m.durationDays} days
                </Text>
              ))}
              <Button
                title="Download PDF"
                variant="outline"
                onPress={() => downloadAndSharePdf(`/doctor/prescriptions/${p.id}/pdf`, `prescription-${p.id.slice(0, 8)}.pdf`)}
                style={{ marginTop: 10 }}
              />
            </Card>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="💬 Message Patient"
          variant="outline"
          onPress={() =>
            navigation.navigate('Messages', {
              screen: 'Chat',
              params: { partnerId: detail.patient.user.id, partnerName: detail.patient.user.name },
            })
          }
          style={{ marginBottom: 10 }}
        />
        <Button title="+ Write Prescription" onPress={() => setShowModal(true)} />
      </View>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.modalTitle}>Write prescription</Text>
            {meds.map((med, i) => (
              <View key={i} style={styles.medBlock}>
                <View style={styles.medBlockHeader}>
                  <Text style={styles.medBlockTitle}>Medication {i + 1}</Text>
                  {meds.length > 1 ? (
                    <Pressable onPress={() => removeMedRow(i)}>
                      <Text style={styles.removeLink}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                <TextInput style={styles.input} placeholder="Name (e.g. Amoxicillin)" value={med.name} onChangeText={(v) => updateMed(i, 'name', v)} />
                <TextInput style={styles.input} placeholder="Dosage (e.g. 500mg)" value={med.dosage} onChangeText={(v) => updateMed(i, 'dosage', v)} />
                <TextInput style={styles.input} placeholder="Frequency (e.g. Twice daily)" value={med.frequency} onChangeText={(v) => updateMed(i, 'frequency', v)} />
                <TextInput
                  style={styles.input}
                  placeholder="Duration (days)"
                  keyboardType="numeric"
                  value={med.durationDays ? String(med.durationDays) : ''}
                  onChangeText={(v) => updateMed(i, 'durationDays', v)}
                />
              </View>
            ))}
            <Button title="+ Add Another Medication" variant="outline" onPress={addMedRow} style={{ marginBottom: 16 }} />
            <Button title="Save Prescription" onPress={submitPrescription} loading={submitting} />
            <Button title="Cancel" variant="outline" onPress={() => setShowModal(false)} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 20, marginBottom: 12 },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  reason: { fontSize: 14, color: colors.textPrimary, marginTop: 8 },
  medLine: { fontSize: 13, color: colors.textPrimary, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { padding: 16, backgroundColor: colors.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: colors.textPrimary },
  medBlock: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12, marginBottom: 12 },
  medBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  medBlockTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  removeLink: { color: colors.error, fontWeight: '600', fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: radius.sm, padding: 12, marginBottom: 8 },
});
