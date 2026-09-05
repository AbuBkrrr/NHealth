import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { patientApi, Appointment } from '../../api/patient';
import { Card } from '../../components/Card';
import { colors, radius } from '../../theme/colors';

const QUICK_ACTIONS = [
  { key: 'Emergency', label: 'Emergency', icon: '🚨' },
  { key: 'Appointments', label: 'Appointments', icon: '🩺' },
  { key: 'Pharmacy', label: 'Pharmacy', icon: '💊' },
  { key: 'Labs', label: 'Labs', icon: '🧪' },
  { key: 'Providers', label: 'Providers', icon: '👨‍⚕️' },
  { key: 'Donate', label: 'Donate', icon: '❤️' },
  { key: 'Insurance', label: 'Insurance', icon: '📋' },
  { key: 'Messages', label: 'Messages', icon: '💬' },
];

export function PatientHomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    // Set header options with icons
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerIcons}>
          <Pressable onPress={() => navigation.navigate('Messages')} style={styles.headerIcon}>
            <Text style={styles.headerIconText}>🔔</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Profile')} style={styles.headerIcon}>
            <Text style={styles.headerIconText}>👤</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    patientApi
      .listAppointments()
      .then((appts) => {
        setAppointments(appts);
        setNextAppointment(appts.find((a) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED') ?? null);
      })
      .catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {/* GREETING */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, 👋 {user?.name?.split(' ')[0]}</Text>
        <Text style={styles.subGreeting}>Your complete health companion</Text>
      </View>

      {/* WALLET CARD */}
      <Card style={styles.walletCard}>
        <Text style={styles.walletLabel}>Wallet Balance</Text>
        <Text style={styles.walletAmount}>₦{(Math.random() * 500000).toFixed(2)}</Text>
        <Text style={styles.walletStatus}>✓ NHIS Active</Text>
        <View style={styles.walletActions}>
          <Pressable style={styles.walletButton} onPress={() => navigation.navigate('Fund')}>
            <Text style={styles.walletButtonText}>💰 Fund</Text>
          </Pressable>
          <Pressable style={styles.walletButtonOutline} onPress={() => navigation.navigate('History')}>
            <Text style={styles.walletButtonTextOutline}>📋 History</Text>
          </Pressable>
        </View>
      </Card>

      {/* QUICK ACTIONS GRID */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {QUICK_ACTIONS.map((a) => (
          <Pressable 
            key={a.key} 
            style={styles.actionTile} 
            onPress={() => navigation.navigate(a.key)}
          >
            <Text style={styles.actionIcon}>{a.icon}</Text>
            <Text style={styles.actionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* UPCOMING APPOINTMENTS */}
      {appointments.length > 0 && (
        <View style={{ marginHorizontal: 16 }}>
          <View style={styles.upcomingHeader}>
            <Text style={styles.upcomingTitle}>📅 Upcoming</Text>
            <Pressable onPress={() => navigation.navigate('Appointments')}>
              <Text style={styles.seeAllLink}>See All</Text>
            </Pressable>
          </View>

          {nextAppointment && (
            <Card style={{ marginBottom: 12 }}>
              <Text style={styles.appointmentDoctor}>Dr. {nextAppointment.doctor.user.name}</Text>
              <Text style={styles.appointmentSpecialty}>{nextAppointment.doctor.specialty} • Today, 10:00 AM</Text>
              <View style={styles.appointmentStatus}>
                <Text style={styles.appointmentStatusBadge}>{nextAppointment.status}</Text>
              </View>
            </Card>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.surface,
    paddingTop: 16,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 16,
  },
  headerIcon: {
    padding: 8,
  },
  headerIconText: {
    fontSize: 20,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  greeting: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: colors.textPrimary 
  },
  subGreeting: { 
    fontSize: 14, 
    color: colors.textSecondary, 
    marginTop: 4 
  },
  walletCard: {
    backgroundColor: colors.primary,
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 20,
  },
  walletLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  walletAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    marginVertical: 8,
  },
  walletStatus: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.white,
    marginBottom: 16,
  },
  walletActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  walletButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  walletButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  walletButtonOutline: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  walletButtonTextOutline: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionTile: {
    width: '23%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  appointmentDoctor: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  appointmentSpecialty: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  appointmentStatus: {
    marginTop: 12,
  },
  appointmentStatusBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
});
