import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { patientApi, Appointment } from '../../api/patient';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { useSocket } from '../../hooks/useSocket';

export function PatientAppointmentsScreen({ navigation }: any) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    patientApi.listAppointments().then(setAppointments).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocket({ 'appointment:updated': load });

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const cancel = async (id: string) => {
    try {
      await patientApi.cancelAppointment(id);
      load();
    } catch (err: any) {
      Alert.alert('Could not cancel', getErrorMessage(err));
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        data={appointments}
        keyExtractor={(a) => a.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState icon="🩺" title="No appointments yet" subtitle="Book a doctor to get started." />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.doctorName}>Dr. {item.doctor.user.name}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.meta}>{new Date(item.scheduledAt).toLocaleString()}</Text>
            <Text style={styles.meta}>{item.type === 'VIDEO' ? '📹 Video call' : '🏥 In person'}</Text>
            {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
            {item.status === 'PENDING' || item.status === 'CONFIRMED' ? (
              <Button title="Cancel" variant="outline" onPress={() => cancel(item.id)} style={{ marginTop: 12 }} />
            ) : null}
          </Card>
        )}
      />
      <View style={styles.footer}>
        <Button title="+ Book New Appointment" onPress={() => navigation.navigate('Home', { screen: 'Providers' })} />
        <Button
          title="View Prescriptions"
          variant="outline"
          onPress={() => navigation.navigate('Prescriptions')}
          style={{ marginTop: 10 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  doctorName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  reason: { fontSize: 14, color: colors.textPrimary, marginTop: 8 },
  footer: { padding: 16, backgroundColor: colors.white },
});
