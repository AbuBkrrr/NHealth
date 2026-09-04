import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { ambulanceApi, AmbulanceStats, AmbulanceProfile } from '../../api/ambulance';
import { Card } from '../../components/Card';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';

export function AmbulanceHomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [stats, setStats] = useState<AmbulanceStats | null>(null);
  const [profile, setProfile] = useState<AmbulanceProfile | null>(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const load = useCallback(() => {
    ambulanceApi.getStats().then(setStats).catch(() => {});
    ambulanceApi.getProfile().then(setProfile).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAvailability = async (value: boolean) => {
    setTogglingAvailability(true);
    try {
      const updated = await ambulanceApi.setAvailability(value);
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
              {profile?.isAvailable ? '🟢 On duty' : '⚪ Off duty'}
            </Text>
            <Text style={styles.meta}>
              {profile?.isAvailable ? 'You can receive new emergency calls' : 'You will not receive new calls'}
            </Text>
          </View>
          <Switch
            value={profile?.isAvailable ?? false}
            onValueChange={toggleAvailability}
            disabled={togglingAvailability || !profile}
            trackColor={{ true: colors.ambulance }}
          />
        </View>
      </Card>

      <View style={styles.statsGrid}>
        <Pressable style={styles.statTile} onPress={() => navigation.navigate('Requests')}>
          <Text style={[styles.statNumber, (stats?.availableCount ?? 0) > 0 && { color: colors.emergencyRed }]}>
            {stats?.availableCount ?? '—'}
          </Text>
          <Text style={styles.statLabel}>Waiting for pickup</Text>
        </Pressable>
        <Pressable style={styles.statTile} onPress={() => navigation.navigate('Requests')}>
          <Text style={styles.statNumber}>{stats?.activeCount ?? '—'}</Text>
          <Text style={styles.statLabel}>Your active calls</Text>
        </Pressable>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{stats?.completedToday ?? '—'}</Text>
          <Text style={styles.statLabel}>Completed today</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{stats?.completedTotal ?? '—'}</Text>
          <Text style={styles.statLabel}>Total completed</Text>
        </View>
      </View>

      {(stats?.availableCount ?? 0) > 0 && (
        <Pressable onPress={() => navigation.navigate('Requests')}>
          <Card style={{ backgroundColor: colors.emergencyRed + '15' }}>
            <Text style={styles.alertText}>
              🚨 {stats!.availableCount} emergency request{stats!.availableCount === 1 ? '' : 's'} waiting — tap to view
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
  statNumber: { fontSize: 24, fontWeight: '800', color: colors.ambulance },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  alertText: { fontSize: 14, fontWeight: '700', color: colors.emergencyRed, textAlign: 'center' },
});
