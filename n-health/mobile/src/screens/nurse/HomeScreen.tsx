import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { nurseApi, NurseStats, NurseProfile } from '../../api/nurse';
import { Card } from '../../components/Card';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';

export function NurseHomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [stats, setStats] = useState<NurseStats | null>(null);
  const [profile, setProfile] = useState<NurseProfile | null>(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const load = useCallback(() => {
    nurseApi.getStats().then(setStats).catch(() => {});
    nurseApi.getProfile().then(setProfile).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAvailability = async (value: boolean) => {
    setTogglingAvailability(true);
    try {
      const updated = await nurseApi.setAvailability(value);
      setProfile((p) => (p ? { ...p, isAvailable: updated.isAvailable } : p));
    } catch (err: any) {
      Alert.alert('Could not update availability', getErrorMessage(err));
    } finally {
      setTogglingAvailability(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.greeting}>Welcome back 👋</Text>
      <Text style={styles.subGreeting}>{user?.name}</Text>

      <Card>
        <View style={styles.availabilityRow}>
          <View>
            <Text style={styles.availabilityTitle}>
              {profile?.isAvailable ? '🟢 Available' : '⚪ Unavailable'}
            </Text>
            <Text style={styles.meta}>
              {profile?.isAvailable ? 'You can receive new visit requests' : 'You will not receive new requests'}
            </Text>
          </View>
          <Switch
            value={profile?.isAvailable ?? false}
            onValueChange={toggleAvailability}
            disabled={togglingAvailability || !profile}
            trackColor={{ true: colors.nurse }}
          />
        </View>
      </Card>

      <View style={styles.statsGrid}>
        <Pressable style={styles.statTile} onPress={() => navigation.navigate('Requests')}>
          <Text style={[styles.statNumber, (stats?.awaitingCount ?? 0) > 0 && { color: colors.nurse }]}>
            {stats?.awaitingCount ?? '—'}
          </Text>
          <Text style={styles.statLabel}>Awaiting your action</Text>
        </Pressable>
        <Pressable style={styles.statTile} onPress={() => navigation.navigate('Requests')}>
          <Text style={styles.statNumber}>{stats?.activeCount ?? '—'}</Text>
          <Text style={styles.statLabel}>Visits in progress</Text>
        </Pressable>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{stats?.completedToday ?? '—'}</Text>
          <Text style={styles.statLabel}>Completed today</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>₦{(stats?.todayRevenue ?? 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>Today's revenue</Text>
        </View>
      </View>

      {(stats?.awaitingCount ?? 0) > 0 && (
        <Pressable onPress={() => navigation.navigate('Requests')}>
          <Card style={{ backgroundColor: colors.nurse + '15' }}>
            <Text style={styles.alertText}>
              🩺 {stats!.awaitingCount} visit request{stats!.awaitingCount === 1 ? '' : 's'} waiting — tap to view
            </Text>
          </Card>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subGreeting: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  availabilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  availabilityTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20, marginBottom: 8 },
  statTile: { width: '47%', backgroundColor: colors.white, borderRadius: 16, padding: 18, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800', color: colors.nurse },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  alertText: { fontSize: 14, fontWeight: '700', color: colors.nurse, textAlign: 'center' },
});
