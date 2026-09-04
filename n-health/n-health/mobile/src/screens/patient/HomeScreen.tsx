import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { patientApi, Appointment } from '../../api/patient';
import { Card } from '../../components/Card';
import { colors, radius } from '../../theme/colors';

const ACTIONS = [
  { key: 'Appointments', label: 'Book Doctor', icon: '🩺' },
  { key: 'Pharmacy', label: 'Order Meds', icon: '💊' },
  { key: 'Labs', label: 'Lab Test', icon: '🧪' },
  { key: 'Providers', label: 'Nurse Visit', icon: '👩‍⚕️' },
  { key: 'Insurance', label: 'Insurance', icon: '📋' },
  { key: 'Donations', label: 'Donate', icon: '❤️' },
];

export function PatientHomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    patientApi
      .listAppointments()
      .then((appts) => setNextAppointment(appts.find((a) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED') ?? null))
      .catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
      <Text style={styles.subGreeting}>How are you feeling today?</Text>

      <Pressable style={styles.emergencyBanner} onPress={() => navigation.navigate('Emergency')}>
        <Text style={styles.emergencyText}>🚨 Emergency? Tap for immediate help</Text>
      </Pressable>

      {nextAppointment && (
        <Card style={{ marginTop: 16 }}>
          <Text style={styles.cardLabel}>Upcoming appointment</Text>
          <Text style={styles.cardTitle}>Dr. {nextAppointment.doctor.user.name}</Text>
          <Text style={styles.cardMeta}>{new Date(nextAppointment.scheduledAt).toLocaleString()}</Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.grid}>
        {ACTIONS.map((a) => (
          <Pressable key={a.key} style={styles.actionTile} onPress={() => navigation.navigate(a.key)}>
            <Text style={styles.actionIcon}>{a.icon}</Text>
            <Text style={styles.actionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subGreeting: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  emergencyBanner: { backgroundColor: colors.emergencyRed, borderRadius: radius.md, padding: 16 },
  emergencyText: { color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' },
  cardLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  cardMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  actionTile: {
    width: '31%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionIcon: { fontSize: 26, marginBottom: 8 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
});
