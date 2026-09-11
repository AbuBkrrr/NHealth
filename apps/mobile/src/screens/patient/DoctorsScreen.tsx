import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Modal, TextInput, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { providerApi, patientApi } from '../../api/patient';
import { Card, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { PaymentModal } from '../../components/PaymentModal';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { useUserLocation } from '../../hooks/useUserLocation';

interface Doctor {
  id: string;
  specialty: string;
  hospital?: string;
  consultationFee: string;
  rating: number;
  distanceKm?: number;
  user: { id: string; name: string };
}

/** Next weekday 10am, just as a sensible starting point in the picker - not the final time. */
function defaultSlot(): Date {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d;
}

export function DoctorsScreen() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selected, setSelected] = useState<Doctor | null>(null);
  const [reason, setReason] = useState('');
  const [apptType, setApptType] = useState<'IN_PERSON' | 'VIDEO'>('IN_PERSON');
  const [scheduledAt, setScheduledAt] = useState<Date>(defaultSlot());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [booking, setBooking] = useState(false);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const location = useUserLocation();

  useEffect(() => {
    providerApi.listDoctors(undefined, location).then(setDoctors).catch(() => {});
  }, [location]);

  const openBooking = (doctor: Doctor) => {
    setSelected(doctor);
    setReason('');
    setApptType('IN_PERSON');
    setScheduledAt(defaultSlot());
  };

  const onChangeDate = (_event: unknown, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setScheduledAt((prev) => {
        const next = new Date(prev);
        next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        return next;
      });
    }
  };

  const onChangeTime = (_event: unknown, date?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (date) {
      setScheduledAt((prev) => {
        const next = new Date(prev);
        next.setHours(date.getHours(), date.getMinutes(), 0, 0);
        return next;
      });
    }
  };

  const book = async () => {
    if (!selected) return;
    if (scheduledAt.getTime() < Date.now()) {
      Alert.alert('Pick a future time', 'The appointment time has already passed - choose another.');
      return;
    }
    setBooking(true);
    try {
      const appointment = await patientApi.createAppointment({
        doctorId: selected.id,
        scheduledAt: scheduledAt.toISOString(),
        type: apptType,
        reason,
      });
      setPendingAppointmentId(appointment.id);
      setReason('');
    } catch (err: any) {
      Alert.alert('Booking failed', getErrorMessage(err));
    } finally {
      setBooking(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={doctors}
        keyExtractor={(d) => d.id}
        ListEmptyComponent={<EmptyState icon="🩺" title="No doctors available yet" />}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.name}>Dr. {item.user.name}</Text>
            <Text style={styles.specialty}>{item.specialty}{item.hospital ? ` · ${item.hospital}` : ''}</Text>
            <View style={styles.row}>
              <Text style={styles.fee}>₦{Number(item.consultationFee).toLocaleString()}</Text>
              <Text style={styles.rating}>⭐ {item.rating.toFixed(1)}</Text>
              {item.distanceKm !== undefined && (
                <Text style={styles.distance}>📍 {item.distanceKm < 1 ? '<1' : item.distanceKm.toFixed(1)} km</Text>
              )}
            </View>
            <Button title="Book Appointment" onPress={() => openBooking(item)} style={{ marginTop: 12 }} />
          </Card>
        )}
      />

      <Modal visible={!!selected && !pendingAppointmentId} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Book Dr. {selected?.user.name}</Text>

            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeChip, apptType === 'IN_PERSON' && styles.typeChipActive]}
                onPress={() => setApptType('IN_PERSON')}
              >
                <Text style={apptType === 'IN_PERSON' ? styles.typeTextActive : styles.typeText}>🏥 In person</Text>
              </Pressable>
              <Pressable
                style={[styles.typeChip, apptType === 'VIDEO' && styles.typeChipActive]}
                onPress={() => setApptType('VIDEO')}
              >
                <Text style={apptType === 'VIDEO' ? styles.typeTextActive : styles.typeText}>📹 Video call</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Date & time</Text>
            <View style={styles.pickerRow}>
              <Pressable style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.pickerButtonText}>
                  {scheduledAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </Pressable>
              <Pressable style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.pickerButtonText}>
                  {scheduledAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Pressable>
            </View>

            {showDatePicker && (
              <DateTimePicker value={scheduledAt} mode="date" minimumDate={new Date()} onChange={onChangeDate} />
            )}
            {showTimePicker && (
              <DateTimePicker value={scheduledAt} mode="time" onChange={onChangeTime} />
            )}

            <Text style={styles.fieldLabel}>Reason for visit</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Follow-up on blood pressure"
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <Button title="Confirm Booking" onPress={book} loading={booking} />
            <Button title="Cancel" variant="outline" onPress={() => setSelected(null)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>

      {pendingAppointmentId && selected && (
        <PaymentModal
          visible={!!pendingAppointmentId}
          payableType="APPOINTMENT"
          payableId={pendingAppointmentId}
          label={`consultation with Dr. ${selected.user.name}`}
          onConfirmed={() => Alert.alert('Payment confirmed', `Dr. ${selected.user.name} has confirmed your payment.`)}
          onClose={() => {
            setPendingAppointmentId(null);
            setSelected(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  specialty: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  fee: { fontSize: 14, fontWeight: '600', color: colors.primary },
  rating: { fontSize: 14, color: colors.textSecondary },
  distance: { fontSize: 12, color: colors.textLight },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: colors.textPrimary },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeChip: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center' },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeText: { color: colors.textSecondary, fontWeight: '600' },
  typeTextActive: { color: colors.primary, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 },
  pickerRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  pickerButton: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 14, alignItems: 'center' },
  pickerButtonText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 14, minHeight: 80, marginBottom: 16, textAlignVertical: 'top' },
});
