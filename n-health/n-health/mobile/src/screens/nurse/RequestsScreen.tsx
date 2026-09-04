import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { nurseApi, NurseRequest } from '../../api/nurse';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { useSocket } from '../../hooks/useSocket';

const FILTERS: { key: 'AVAILABLE' | 'ACTIVE' | 'COMPLETED'; label: string }[] = [
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'ACTIVE', label: 'In progress' },
  { key: 'COMPLETED', label: 'History' },
];

const NEXT_ACTION: Record<string, { label: string; next: 'IN_PROGRESS' | 'COMPLETED' } | undefined> = {
  ACCEPTED: { label: 'Start Visit', next: 'IN_PROGRESS' },
  IN_PROGRESS: { label: 'Complete Visit', next: 'COMPLETED' },
};

function AvailableRequestCard({ request, onAccepted }: { request: NurseRequest; onAccepted: () => void }) {
  const [accepting, setAccepting] = useState(false);

  const accept = () => {
    Alert.alert('Accept this request?', 'You will be assigned to this patient visit.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          setAccepting(true);
          try {
            await nurseApi.acceptRequest(request.id);
            onAccepted();
          } catch (err: any) {
            Alert.alert('Could not accept', getErrorMessage(err));
            onAccepted(); // refresh - someone else may have already claimed it
          } finally {
            setAccepting(false);
          }
        },
      },
    ]);
  };

  return (
    <Card style={{ borderLeftWidth: 4, borderLeftColor: colors.nurse }}>
      <View style={styles.row}>
        <Text style={styles.patient}>{request.patient.user.name}</Text>
        <Text style={styles.time}>{new Date(request.createdAt).toLocaleTimeString()}</Text>
      </View>
      <Text style={styles.meta}>{request.serviceType}</Text>
      {request.scheduledAt ? (
        <Text style={styles.meta}>🗓️ {new Date(request.scheduledAt).toLocaleString()}</Text>
      ) : null}
      {request.notes ? <Text style={styles.notes}>"{request.notes}"</Text> : null}
      <Button title="Accept Request" onPress={accept} loading={accepting} style={{ marginTop: 12 }} />
    </Card>
  );
}

function ActiveRequestCard({ request, onChanged }: { request: NurseRequest; onChanged: () => void }) {
  const [acting, setActing] = useState(false);
  const action = NEXT_ACTION[request.status];

  const setStatus = async (status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    setActing(true);
    try {
      await nurseApi.updateRequestStatus(request.id, status);
      onChanged();
    } catch (err: any) {
      Alert.alert('Could not update visit', getErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const cancel = () => {
    Alert.alert('Cancel this visit?', undefined, [
      { text: 'Keep visit', style: 'cancel' },
      { text: 'Cancel visit', style: 'destructive', onPress: () => setStatus('CANCELLED') },
    ]);
  };

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.patient}>{request.patient.user.name}</Text>
        <StatusBadge status={request.status} />
      </View>
      <Text style={styles.meta}>{request.serviceType}</Text>
      {request.patient.user.phone ? <Text style={styles.meta}>📞 {request.patient.user.phone}</Text> : null}
      {request.notes ? <Text style={styles.notes}>"{request.notes}"</Text> : null}
      {action && (
        <View style={styles.actionsRow}>
          <Button
            title={action.label}
            onPress={() => setStatus(action.next)}
            loading={acting}
            disabled={request.status === 'ACCEPTED' && !request.isPaid}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button title="Cancel" variant="outline" onPress={cancel} loading={acting} style={{ flex: 1 }} />
        </View>
      )}
      {action && request.status === 'ACCEPTED' && !request.isPaid && (
        <Text style={styles.waitingNote}>Waiting for the patient's payment to be confirmed.</Text>
      )}
    </Card>
  );
}

export function NurseRequestsScreen() {
  const [filter, setFilter] = useState<'AVAILABLE' | 'ACTIVE' | 'COMPLETED'>('AVAILABLE');
  const [available, setAvailable] = useState<NurseRequest[]>([]);
  const [mine, setMine] = useState<NurseRequest[]>([]);

  const load = useCallback(() => {
    nurseApi.listAvailable().then(setAvailable).catch(() => {});
    nurseApi.listMine().then(setMine).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocket({ 'nurse:new': load, 'nurse:claimed': load });

  const activeMine = mine.filter((r) => ['ACCEPTED', 'IN_PROGRESS'].includes(r.status));
  const historyMine = mine.filter((r) => ['COMPLETED', 'CANCELLED'].includes(r.status));

  const data = filter === 'AVAILABLE' ? available : filter === 'ACTIVE' ? activeMine : historyMine;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={styles.tabs}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} style={[styles.tab, filter === f.key && styles.tabActive]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.tabText, filter === f.key && styles.tabTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        data={data}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <EmptyState
            icon="🩺"
            title={filter === 'AVAILABLE' ? 'No requests waiting' : filter === 'ACTIVE' ? 'No visits in progress' : 'No completed visits yet'}
          />
        }
        renderItem={({ item }) =>
          filter === 'AVAILABLE' ? (
            <AvailableRequestCard request={item} onAccepted={load} />
          ) : (
            <ActiveRequestCard request={item} onChanged={load} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.white, padding: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: colors.nurseLight },
  tabText: { fontWeight: '600', color: colors.textSecondary, fontSize: 12 },
  tabTextActive: { color: colors.nurse },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patient: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  time: { fontSize: 12, color: colors.textLight },
  notes: { fontSize: 13, color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  actionsRow: { flexDirection: 'row', marginTop: 12 },
  waitingNote: { fontSize: 12, color: colors.textLight, marginTop: 8, fontStyle: 'italic' },
});
