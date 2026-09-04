import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { providerApi, patientApi } from '../../api/patient';
import { Card, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { PaymentModal } from '../../components/PaymentModal';
import { colors } from '../../theme/colors';
import { DoctorsScreen } from './DoctorsScreen';
import { getErrorMessage } from '../../utils/errorMessage';

interface Nurse { id: string; specialty?: string; hourlyRate: string; user: { name: string }; }

function NursesTab() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ id: string; nurseName: string } | null>(null);

  useEffect(() => {
    providerApi.listNurses().then(setNurses).catch(() => {});
  }, []);

  const request = async (nurse: Nurse) => {
    setRequesting(nurse.id);
    try {
      const created = await patientApi.requestNurse({ nurseId: nurse.id, serviceType: nurse.specialty ?? 'Home Care' });
      setPendingRequest({ id: created.id, nurseName: nurse.user.name });
    } catch (err: any) {
      Alert.alert('Request failed', getErrorMessage(err));
    } finally {
      setRequesting(null);
    }
  };

  // Broadcasts to every available nurse rather than picking one from the list -
  // useful when the person just needs care quickly and doesn't have a preference.
  const requestAnyNurse = async () => {
    setRequesting('ANY');
    try {
      const created = await patientApi.requestNurse({ serviceType: 'General Care' });
      setPendingRequest({ id: created.id, nurseName: 'your nurse' });
    } catch (err: any) {
      Alert.alert('Request failed', getErrorMessage(err));
    } finally {
      setRequesting(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Button
        title="🩺 Request Any Available Nurse"
        variant="outline"
        onPress={requestAnyNurse}
        loading={requesting === 'ANY'}
        style={{ margin: 16, marginBottom: 0 }}
      />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={nurses}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<EmptyState icon="👩‍⚕️" title="No nurses available right now" />}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.name}>{item.user.name}</Text>
            <Text style={styles.meta}>{item.specialty ?? 'General Care'} · ₦{Number(item.hourlyRate).toLocaleString()}/hr</Text>
            <Button title="Request Visit" onPress={() => request(item)} loading={requesting === item.id} style={{ marginTop: 12 }} />
          </Card>
        )}
      />

      {pendingRequest && (
        <PaymentModal
          visible={!!pendingRequest}
          payableType="NURSE_REQUEST"
          payableId={pendingRequest.id}
          label={`nurse visit with ${pendingRequest.nurseName}`}
          onConfirmed={() => Alert.alert('Payment confirmed', `${pendingRequest.nurseName} has confirmed your payment.`)}
          onClose={() => setPendingRequest(null)}
        />
      )}
    </View>
  );
}

export function ProvidersScreen() {
  const [tab, setTab] = useState<'DOCTORS' | 'NURSES'>('DOCTORS');

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'DOCTORS' && styles.tabActive]} onPress={() => setTab('DOCTORS')}>
          <Text style={[styles.tabText, tab === 'DOCTORS' && styles.tabTextActive]}>Doctors</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'NURSES' && styles.tabActive]} onPress={() => setTab('NURSES')}>
          <Text style={[styles.tabText, tab === 'NURSES' && styles.tabTextActive]}>Nurses</Text>
        </Pressable>
      </View>
      {tab === 'DOCTORS' ? <DoctorsScreen /> : <NursesTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.white, padding: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primaryLight },
  tabText: { fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
