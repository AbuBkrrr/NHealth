import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { colors, roleColor } from '../theme/colors';

const ROLE_LABEL: Record<string, string> = {
  DOCTOR: 'Doctor',
  PHARMACY: 'Pharmacy',
  LAB: 'Lab',
  AMBULANCE: 'Ambulance',
  NURSE: 'Nurse',
};

/**
 * Shown for roles whose full screen set hasn't been built yet
 * (Phase 1 shipped the Patient app; Doctor/Pharmacy/Lab/Ambulance/Nurse
 * follow in later phases). The account and backend already exist -
 * only the UI is pending.
 */
export function ComingSoonScreen() {
  const { user, logout } = useAuth();
  const label = user ? ROLE_LABEL[user.role] : '';
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🚧</Text>
      <Text style={[styles.title, { color: roleColor[user?.role ?? 'PATIENT'] }]}>{label} app coming soon</Text>
      <Text style={styles.subtitle}>
        Your {label.toLowerCase()} account is created and the backend is ready - this role's screens are being
        built in the next phase.
      </Text>
      <Button title="Log Out" variant="outline" onPress={logout} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 20 },
});
