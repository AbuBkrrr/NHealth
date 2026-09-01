import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { doctorApi, DoctorPatient } from '../../api/doctor';
import { Card, EmptyState } from '../../components/Card';
import { colors } from '../../theme/colors';

export function DoctorPatientsScreen({ navigation }: any) {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);

  useFocusEffect(
    useCallback(() => {
      doctorApi.listPatients().then(setPatients).catch(() => {});
    }, [])
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      data={patients}
      keyExtractor={(p) => p.id}
      ListEmptyComponent={
        <EmptyState icon="👥" title="No patients yet" subtitle="Patients you've had appointments with will show up here." />
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate('PatientDetail', { patientId: item.id, patientName: item.user.name })}>
          <Card>
            <Text style={styles.name}>{item.user.name}</Text>
            {item.bloodType ? <Text style={styles.meta}>Blood type: {item.bloodType}</Text> : null}
            {item.allergies ? <Text style={styles.meta}>Allergies: {item.allergies}</Text> : null}
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
