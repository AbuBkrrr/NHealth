import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { labApi, LabStats, LabTest } from '../../api/lab';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { colors } from '../../theme/colors';

export function LabHomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [stats, setStats] = useState<LabStats | null>(null);
  const [awaiting, setAwaiting] = useState<LabTest[]>([]);

  const load = useCallback(() => {
    labApi.getStats().then(setStats).catch(() => {});
    labApi.listTests('REQUESTED').then((tests) => setAwaiting(tests.slice(0, 5))).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.greeting}>Welcome back 👋</Text>
      <Text style={styles.subGreeting}>{user?.name}</Text>

      <View style={styles.statsGrid}>
        <Pressable style={styles.statTile} onPress={() => navigation.navigate('Tests')}>
          <Text style={styles.statNumber}>{stats?.awaitingSample ?? '—'}</Text>
          <Text style={styles.statLabel}>Awaiting sample</Text>
        </Pressable>
        <Pressable style={styles.statTile} onPress={() => navigation.navigate('Tests')}>
          <Text style={styles.statNumber}>{stats?.inProgress ?? '—'}</Text>
          <Text style={styles.statLabel}>In progress</Text>
        </Pressable>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{stats?.completedCount ?? '—'}</Text>
          <Text style={styles.statLabel}>Completed tests</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>₦{(stats?.todayRevenue ?? 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>Today's revenue</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>New test requests</Text>
      {awaiting.length === 0 ? (
        <Card>
          <EmptyState icon="🧪" title="No new requests" subtitle="New patient test requests will show up here." />
        </Card>
      ) : (
        awaiting.map((t) => (
          <Pressable key={t.id} onPress={() => navigation.navigate('Tests')}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.patient}>{t.patient.user.name}</Text>
                <StatusBadge status={t.status} />
              </View>
              <Text style={styles.meta}>{t.testType} · {t.isPaid ? 'Paid' : 'Awaiting payment'}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subGreeting: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statTile: { width: '47%', backgroundColor: colors.white, borderRadius: 16, padding: 18, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800', color: colors.lab },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patient: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
