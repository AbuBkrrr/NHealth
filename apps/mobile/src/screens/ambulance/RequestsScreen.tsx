import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { ambulanceApi, EmergencyRequest } from '../../api/ambulance';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { useSocket } from '../../hooks/useSocket';

const FILTERS: { key: 'AVAILABLE' | 'ACTIVE' | 'COMPLETED'; label: string }[] = [
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'ACTIVE', label: 'My active calls' },
  { key: 'COMPLETED', label: 'History' },
];

const NEXT_ACTION: Record<string, { label: string; next: 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' } | undefined> = {
  ACCEPTED: { label: "I'm En Route", next: 'EN_ROUTE' },
  EN_ROUTE: { label: 'Arrived on Scene', next: 'ARRIVED' },
  ARRIVED: { label: 'Complete Call', next: 'COMPLETED' },
};

/** While mounted, pings the server with the device's live location every 15s
 *  so patients tracking an active call see the ambulance's position update. */
function useLiveLocationBroadcast(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const ping = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          await ambulanceApi.updateLocation(loc.coords.latitude, loc.coords.longitude);
        } catch {
          // Best-effort - a missed ping isn't worth surfacing to the driver.
        }
      };
      ping();
      interval = setInterval(ping, 15000);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [active]);
}

function AvailableRequestCard({ request, onAccepted }: { request: EmergencyRequest; onAccepted: () => void }) {
  const [accepting, setAccepting] = useState(false);

  const accept = () => {
    Alert.alert('Accept this call?', 'You will be assigned as the responding ambulance.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          setAccepting(true);
          try {
            await ambulanceApi.acceptRequest(request.id);
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
    <Card style={{ borderLeftWidth: 4, borderLeftColor: colors.emergencyRed }}>
      <View style={styles.row}>
        <Text style={styles.patient}>{request.patient.user.name}</Text>
        <Text style={styles.time}>{new Date(request.requestedAt).toLocaleTimeString()}</Text>
      </View>
      {request.notes ? <Text style={styles.notes}>"{request.notes}"</Text> : null}
      <Text style={styles.meta}>📍 {request.lat.toFixed(4)}, {request.lng.toFixed(4)}</Text>
      <Button title="Accept Call" variant="danger" onPress={accept} loading={accepting} style={{ marginTop: 12 }} />
    </Card>
  );
}

function ActiveRequestCard({ request, onChanged }: { request: EmergencyRequest; onChanged: () => void }) {
  const [acting, setActing] = useState(false);
  const action = NEXT_ACTION[request.status];
  useLiveLocationBroadcast(request.status === 'EN_ROUTE' || request.status === 'ARRIVED');

  const setStatus = async (status: 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED') => {
    setActing(true);
    try {
      await ambulanceApi.updateRequestStatus(request.id, status);
      onChanged();
    } catch (err: any) {
      Alert.alert('Could not update call', getErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const cancel = () => {
    Alert.alert('Cancel this call?', undefined, [
      { text: 'Keep call', style: 'cancel' },
      { text: 'Cancel call', style: 'destructive', onPress: () => setStatus('CANCELLED') },
    ]);
  };

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.patient}>{request.patient.user.name}</Text>
        <StatusBadge status={request.status} />
      </View>
      {request.patient.user.phone ? <Text style={styles.meta}>📞 {request.patient.user.phone}</Text> : null}
      {request.notes ? <Text style={styles.notes}>"{request.notes}"</Text> : null}
      <Text style={styles.meta}>📍 {request.lat.toFixed(4)}, {request.lng.toFixed(4)}</Text>
      {action && (
        <View style={styles.actionsRow}>
          <Button title={action.label} onPress={() => setStatus(action.next)} loading={acting} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Cancel" variant="outline" onPress={cancel} loading={acting} style={{ flex: 1 }} />
        </View>
      )}
    </Card>
  );
}

export function AmbulanceRequestsScreen() {
  const [filter, setFilter] = useState<'AVAILABLE' | 'ACTIVE' | 'COMPLETED'>('AVAILABLE');
  const [available, setAvailable] = useState<EmergencyRequest[]>([]);
  const [mine, setMine] = useState<EmergencyRequest[]>([]);
  // useSocket only re-subscribes its listeners when the auth token changes,
  // not on every render - so a handler that reads `mine` directly would only
  // ever see it as it was on the very first render. This ref always holds
  // the latest value for the handler below to read instead.
  const mineRef = useRef(mine);
  mineRef.current = mine;

  const load = useCallback(() => {
    ambulanceApi.listAvailable().then(setAvailable).catch(() => {});
    ambulanceApi.listMine().then(setMine).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocket({
    'emergency:new': load,
    'emergency:claimed': load,
    'emergency:cancelled': (payload: { id: string }) => {
      // The driver may already be en route - a silent list refresh isn't
      // enough here, they need an explicit heads-up that the trip is off.
      const wasActive = mineRef.current.some(
        (r) => r.id === payload.id && ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(r.status)
      );
      if (wasActive) {
        Alert.alert('Request cancelled', 'The patient has cancelled this emergency request.');
      }
      load();
    },
  });

  const activeMine = mine.filter((r) => ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(r.status));
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
            icon="🚑"
            title={filter === 'AVAILABLE' ? 'No calls waiting' : filter === 'ACTIVE' ? 'No active calls' : 'No completed calls yet'}
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
  tabActive: { backgroundColor: colors.ambulanceLight },
  tabText: { fontWeight: '600', color: colors.textSecondary, fontSize: 12 },
  tabTextActive: { color: colors.ambulance },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patient: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  time: { fontSize: 12, color: colors.textLight },
  notes: { fontSize: 13, color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  actionsRow: { flexDirection: 'row', marginTop: 12 },
});
