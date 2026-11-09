import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { WEB_APP_URL } from '../api/payment';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { colors, roleColor } from '../theme/colors';

const ROLE_LABEL: Record<string, string> = {
  DOCTOR: 'Doctor',
  PHARMACY: 'Pharmacy',
  LAB: 'Lab',
  AMBULANCE: 'Ambulance',
  NURSE: 'Nurse',
  INSTITUTION: 'Institution',
};

/**
 * Shown for roles whose screens live in the web app (currently Institution)
 * (Phase 1 shipped the Patient app; Doctor/Pharmacy/Lab/Ambulance/Nurse
 * follow in later phases). The account and backend already exist -
 * only the UI is pending.
 */
export function ComingSoonScreen() {
  const { user, logout } = useAuth();
  const label = user ? ROLE_LABEL[user.role] : '';
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🏥</Text>
      <Text style={[styles.title, { color: roleColor[user?.role as keyof typeof roleColor] ?? colors.primary }]}>{label} dashboard</Text>
      <Text style={styles.subtitle}>
        The {label.toLowerCase()} dashboard (departments, staff, patients and reports) runs in the N-Health web app.
        Sign in there with this same account - you can add it to your home screen like an app.
      </Text>
      <Button title="Open dashboard" onPress={() => Linking.openURL(`${WEB_APP_URL}/#/institution/home`)} style={{ marginTop: 24 }} />
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
