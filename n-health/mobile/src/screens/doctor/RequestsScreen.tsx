import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { doctorApi, DoctorAppointment } from '../../api/doctor';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';

export function DoctorRequestsScreen() {
  const [tab, setTab] = useState<'PENDING' | 'UPCOMING'>('PENDING');
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(() => {
    doctorApi.listAppointments().then(setAppointments).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (id: string, action: 'CONFIRM' | 'CANCEL' | 'COMPLETE') => {
    setActingOn(id);
    try {
      await doctorApi.respondToAppointment(id, action);
      load();
    } catch (err: any) {
      Alert.alert('Could not update appointment', getErrorMessage(err));
    } finally {
      setActingOn(null);
    }
  };

  const shown = appointments.filter((a) => (tab === 'PENDING' ? a.status === 'PENDING' : a.status === 'CONFIRMED'));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'PENDING' && styles.tabActive]} onPress={() => setTab('PENDING')}>
          <Text style={[styles.tabText, tab === 'PENDING' && styles.tabTextActive]}>Requests</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'UPCOMING' && styles.tabActive]} onPress={() => setTab('UPCOMING')}>
          <Text style={[styles.tabText, tab === 'UPCOMING' && styles.tabTextActive]}>Upcoming</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={shown}
        keyExtractor={(a) => a.id}
        ListEmptyComponent={
          <EmptyState
            icon="🩺"
            title={tab === 'PENDING' ? 'No pending requests' : 'No upcoming appointments'}
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.name}>{item.patient.user.name}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.meta}>{new Date(item.scheduledAt).toLocaleString()}</Text>
            <Text style={styles.meta}>{item.type === 'VIDEO' ? '📹 Video call' : '🏥 In person'}</Text>
            {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}

            {tab === 'PENDING' ? (
              <View style={styles.actionsRow}>
                <Button
                  title="Accept"
                  onPress={() => respond(item.id, 'CONFIRM')}
                  loading={actingOn === item.id}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Decline"
                  variant="outline"
                  onPress={() => respond(item.id, 'CANCEL')}
                  loading={actingOn === item.id}
                  style={{ flex: 1 }}
                />
              </View>
            ) : (
              <Button
                title="Mark Complete"
                variant="outline"
                onPress={() => respond(item.id, 'COMPLETE')}
                loading={actingOn === item.id}
                style={{ marginTop: 12 }}
              />
            )}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.white, padding: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: colors.doctorLight },
  tabText: { fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.doctor },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  reason: { fontSize: 14, color: colors.textPrimary, marginTop: 8 },
  actionsRow: { flexDirection: 'row', marginTop: 12 },
});
