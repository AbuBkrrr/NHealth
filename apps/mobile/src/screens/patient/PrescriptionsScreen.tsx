import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { patientApi } from '../../api/patient';
import { Card, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { downloadAndSharePdf } from '../../utils/downloadPdf';
import { useSocket } from '../../hooks/useSocket';

interface Medication { name: string; dosage: string; frequency: string; durationDays: number; }
interface Prescription {
  id: string;
  medications: Medication[];
  status: string;
  issuedAt: string;
  doctor: { user: { name: string } };
}

export function PrescriptionsScreen() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  const load = useCallback(() => {
    patientApi.listPrescriptions().then(setPrescriptions).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocket({ 'prescription:new': load });

  return (
    <FlatList
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      data={prescriptions}
      keyExtractor={(p) => p.id}
      ListEmptyComponent={<EmptyState icon="📝" title="No prescriptions yet" subtitle="Prescriptions your doctor issues will show up here." />}
      renderItem={({ item }) => (
        <Card>
          <Text style={styles.doctorName}>Dr. {item.doctor.user.name}</Text>
          <Text style={styles.date}>{new Date(item.issuedAt).toLocaleDateString()}</Text>
          {item.medications.map((med, i) => (
            <View key={i} style={styles.medRow}>
              <Text style={styles.medName}>{med.name}</Text>
              <Text style={styles.medMeta}>{med.dosage} · {med.frequency} · {med.durationDays} days</Text>
            </View>
          ))}
          <Button
            title="Download PDF"
            variant="outline"
            onPress={() => downloadAndSharePdf(`/patient/prescriptions/${item.id}/pdf`, `prescription-${item.id.slice(0, 8)}.pdf`)}
            style={{ marginTop: 10 }}
          />
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  doctorName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  date: { fontSize: 12, color: colors.textLight, marginTop: 2, marginBottom: 10 },
  medRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  medName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  medMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
