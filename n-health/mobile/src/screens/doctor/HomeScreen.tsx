import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { doctorApi, DoctorAppointment } from '../../api/doctor';
import { Card } from '../../components/Card';
import { colors } from '../../theme/colors';

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function DoctorHomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);

  useFocusEffect(
    useCallback(() => {
      doctorApi.listAppointments().then(setAppointments).catch(() => {});
    }, [])
  );

  const pendingCount = appointments.filter((a) => a.status === 'PENDING').length;
  const todaysConfirmed = appointments.filter((a) => a.status === 'CONFIRMED' && isToday(a.scheduledAt));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.greeting}>Good day, Dr. {user?.name?.split(' ')[0]} 👋</Text>
      <Text style={styles.subGreeting}>Here's what's on your schedule</Text>

      <View style={styles.statsRow}>
        <Pressable style={styles.statTile} onPress={() => navigation.navigate('Requests')}>
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending requests</Text>
        </Pressable>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{todaysConfirmed.length}</Text>
          <Text style={styles.statLabel}>Today's appointments</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Today's schedule</Text>
      {todaysConfirmed.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>Nothing confirmed for today.</Text>
        </Card>
      ) : (
        todaysConfirmed.map((a) => (
          <Card key={a.id}>
            <Text style={styles.patientName}>{a.patient.user.name}</Text>
            <Text style={styles.meta}>
              {new Date(a.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ·{' '}
              {a.type === 'VIDEO' ? '📹 Video call' : '🏥 In person'}
            </Text>
            {a.reason ? <Text style={styles.reason}>{a.reason}</Text> : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subGreeting: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statTile: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 18, alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '800', color: colors.doctor },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  patientName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  reason: { fontSize: 14, color: colors.textPrimary, marginTop: 8 },
});
