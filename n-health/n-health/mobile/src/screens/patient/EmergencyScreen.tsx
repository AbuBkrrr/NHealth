import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { patientApi } from '../../api/patient';
import { Button } from '../../components/Button';
import { colors, radius } from '../../theme/colors';
import { useSocket } from '../../hooks/useSocket';
import { getErrorMessage } from '../../utils/errorMessage';

type EmergencyStatus = 'REQUESTED' | 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';
const ACTIVE_STATUSES: EmergencyStatus[] = ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED'];

/** Great-circle distance in km - small client-side mirror of the backend's utils/geo.ts,
 * used only for this one live "ambulance is X km away" readout. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATUS_COPY: Record<EmergencyStatus, { title: string; subtitle: string }> = {
  REQUESTED: {
    title: 'Help is on the way...',
    subtitle: "We've notified nearby ambulances. You'll be updated as soon as one accepts.",
  },
  ACCEPTED: {
    title: 'An ambulance accepted your request',
    subtitle: 'They are preparing to head your way. Stay where you are if safe to do so.',
  },
  EN_ROUTE: {
    title: 'Ambulance is on the way',
    subtitle: 'Track their arrival and keep your phone nearby.',
  },
  ARRIVED: {
    title: 'The ambulance has arrived',
    subtitle: 'Please head to the entrance if you are able to.',
  },
  COMPLETED: { title: '', subtitle: '' },
  CANCELLED: { title: '', subtitle: '' },
};

export function PatientEmergencyScreen() {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);
  const [status, setStatus] = useState<EmergencyStatus | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ambulanceLocation, setAmbulanceLocation] = useState<{ lat: number; lng: number } | null>(null);

  // On mount (including when navigating back to this screen), check whether
  // there's already an active request - otherwise the screen would forget
  // about it and let the person send a duplicate.
  useEffect(() => {
    patientApi
      .listEmergencyRequests()
      .then((requests: { id: string; status: EmergencyStatus; lat: number; lng: number }[]) => {
        const active = requests.find((r) => ACTIVE_STATUSES.includes(r.status));
        setStatus(active?.status ?? null);
        setActiveRequestId(active?.id ?? null);
        if (active) setMyLocation({ lat: active.lat, lng: active.lng });
      })
      .catch(() => {})
      .finally(() => setCheckingActive(false));
  }, []);

  useSocket({
    'emergency:accepted': () => setStatus('ACCEPTED'),
    'emergency:status': (payload: { status: EmergencyStatus }) => setStatus(payload.status),
    'ambulance:location': (payload: { lat: number; lng: number }) => setAmbulanceLocation(payload),
  });

  const cancelRequest = () => {
    Alert.alert('Cancel emergency request?', 'Only do this if help is no longer needed.', [
      { text: 'Keep request', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          if (!activeRequestId) return;
          setCancelling(true);
          try {
            await patientApi.cancelEmergencyRequest(activeRequestId);
            setStatus(null);
            setActiveRequestId(null);
          } catch (err: any) {
            Alert.alert('Could not cancel request', getErrorMessage(err));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const requestHelp = async () => {
    setLoading(true);
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Location needed', 'We need your location to send an ambulance to you.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const created = await patientApi.requestEmergency({ lat: loc.coords.latitude, lng: loc.coords.longitude, notes });
      setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setActiveRequestId(created.id);
      setStatus('REQUESTED');
    } catch (err: any) {
      Alert.alert('Could not send request', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (checkingActive) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.emergencyRed} />
      </View>
    );
  }

  if (status && ACTIVE_STATUSES.includes(status)) {
    const copy = STATUS_COPY[status];
    const distanceKm =
      myLocation && ambulanceLocation
        ? haversineKm(myLocation.lat, myLocation.lng, ambulanceLocation.lat, ambulanceLocation.lng)
        : null;
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.pulseIcon}>🚑</Text>
        <Text style={styles.statusTitle}>{copy.title}</Text>
        <Text style={styles.statusSubtitle}>{copy.subtitle}</Text>
        {distanceKm !== null && (
          <Text style={styles.distanceText}>
            📍 Ambulance is {distanceKm < 1 ? 'less than 1 km' : `about ${distanceKm.toFixed(1)} km`} away
          </Text>
        )}
        <Button
          title="Cancel Request"
          variant="outline"
          onPress={cancelRequest}
          loading={cancelling}
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency Request</Text>
      <Text style={styles.subtitle}>This will share your live location with nearby ambulances.</Text>

      <TextInput
        style={styles.input}
        placeholder="Briefly describe the emergency (optional)"
        multiline
        value={notes}
        onChangeText={setNotes}
      />

      <Button title="🚨 Request Ambulance Now" variant="danger" onPress={requestHelp} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.emergencyRed, marginTop: 12 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 6, marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: radius.sm,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    fontSize: 15,
  },
  pulseIcon: { fontSize: 64, marginBottom: 16 },
  statusTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  statusSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  distanceText: { fontSize: 14, fontWeight: '700', color: colors.emergencyRed, marginTop: 20 },
});
