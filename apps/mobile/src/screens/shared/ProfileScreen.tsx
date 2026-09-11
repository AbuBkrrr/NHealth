import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { patientApi } from '../../api/patient';
import { doctorApi } from '../../api/doctor';
import { pharmacyApi } from '../../api/pharmacy';
import { labApi } from '../../api/lab';
import { ambulanceApi } from '../../api/ambulance';
import { nurseApi } from '../../api/nurse';
import { accountApi } from '../../api/account';
import { AvatarPicker } from '../../components/AvatarPicker';
import { LocationCaptureButton } from '../../components/LocationCaptureButton';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors, roleColor, radius } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';

const ROLE_LABEL: Record<string, string> = {
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  PHARMACY: 'Pharmacy',
  LAB: 'Lab',
  AMBULANCE: 'Ambulance',
  NURSE: 'Nurse',
};

interface PatientDetails {
  bloodType?: string;
  genotype?: string;
  nhisNumber?: string;
  allergies?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

/** Editable medical details, shown only for the Patient role - other roles get their
 * own profile fields once those apps are built. */
function PatientDetailsCard() {
  const [details, setDetails] = useState<PatientDetails>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    patientApi.getProfile().then(setDetails).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      await patientApi.updateProfile(details as Record<string, unknown>);
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Card style={{ marginTop: 16, width: '100%' }}>
        <View style={styles.detailsHeader}>
          <Text style={styles.sectionTitle}>Medical details</Text>
          <Pressable onPress={() => setEditing(true)}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
        <Field label="Blood type" value={details.bloodType} />
        <Field label="Genotype" value={details.genotype} />
        <Field label="NHIS number" value={details.nhisNumber} />
        <Field label="Allergies" value={details.allergies} />
        <Field label="Address" value={details.address} />
        <Field label="Emergency contact" value={details.emergencyContact} />
        <Field label="Emergency phone" value={details.emergencyPhone} />
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 16, width: '100%' }}>
      <Text style={styles.sectionTitle}>Edit medical details</Text>
      <TextInput style={styles.input} placeholder="Blood type (e.g. O+)" value={details.bloodType ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, bloodType: v }))} />
      <TextInput style={styles.input} placeholder="Genotype (e.g. AA)" value={details.genotype ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, genotype: v }))} autoCapitalize="characters" />
      <TextInput style={styles.input} placeholder="NHIS number" value={details.nhisNumber ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, nhisNumber: v }))} />
      <TextInput style={styles.input} placeholder="Allergies" value={details.allergies ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, allergies: v }))} />
      <TextInput style={styles.input} placeholder="Address" value={details.address ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, address: v }))} />
      <TextInput style={styles.input} placeholder="Emergency contact name" value={details.emergencyContact ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, emergencyContact: v }))} />
      <TextInput style={styles.input} placeholder="Emergency contact phone" value={details.emergencyPhone ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, emergencyPhone: v }))} />
      <Button title="Save" onPress={save} loading={saving} />
      <Button title="Cancel" variant="outline" onPress={() => { setEditing(false); load(); }} style={{ marginTop: 10 }} />
    </Card>
  );
}

interface DoctorDetails {
  specialty?: string;
  hospital?: string;
  bio?: string;
  consultationFee?: number;
  yearsExperience?: number;
  lat?: number | null;
  lng?: number | null;
}

/** Editable practice details, shown only for the Doctor role. */
function DoctorDetailsCard() {
  const [details, setDetails] = useState<DoctorDetails>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    doctorApi.getProfile().then(setDetails).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      await doctorApi.updateProfile({
        ...details,
        consultationFee: details.consultationFee !== undefined ? Number(details.consultationFee) : undefined,
        yearsExperience: details.yearsExperience !== undefined ? Number(details.yearsExperience) : undefined,
      });
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Card style={{ marginTop: 16, width: '100%' }}>
        <View style={styles.detailsHeader}>
          <Text style={styles.sectionTitle}>Practice details</Text>
          <Pressable onPress={() => setEditing(true)}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
        <Field label="Specialty" value={details.specialty} />
        <Field label="Hospital" value={details.hospital} />
        <Field label="Consultation fee" value={details.consultationFee ? `₦${Number(details.consultationFee).toLocaleString()}` : undefined} />
        <Field label="Years of experience" value={details.yearsExperience?.toString()} />
        <Field label="Bio" value={details.bio} />
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 16, width: '100%' }}>
      <Text style={styles.sectionTitle}>Edit practice details</Text>
      <TextInput style={styles.input} placeholder="Specialty" value={details.specialty ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, specialty: v }))} />
      <TextInput style={styles.input} placeholder="Hospital / clinic" value={details.hospital ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, hospital: v }))} />
      <TextInput
        style={styles.input}
        placeholder="Consultation fee (₦)"
        keyboardType="numeric"
        value={details.consultationFee?.toString() ?? ''}
        onChangeText={(v) => setDetails((d) => ({ ...d, consultationFee: Number(v) || 0 }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Years of experience"
        keyboardType="numeric"
        value={details.yearsExperience?.toString() ?? ''}
        onChangeText={(v) => setDetails((d) => ({ ...d, yearsExperience: Number(v) || 0 }))}
      />
      <TextInput style={styles.input} placeholder="Short bio" value={details.bio ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, bio: v }))} multiline />
      <LocationCaptureButton lat={details.lat} lng={details.lng} onCaptured={(lat, lng) => setDetails((d) => ({ ...d, lat, lng }))} />
      <Button title="Save" onPress={save} loading={saving} style={{ marginTop: 16 }} />
      <Button title="Cancel" variant="outline" onPress={() => { setEditing(false); load(); }} style={{ marginTop: 10 }} />
    </Card>
  );
}

interface PharmacyDetails {
  pharmacyName?: string;
  address?: string;
  operatingHours?: string;
  lat?: number | null;
  lng?: number | null;
}

/** Editable store details, shown only for the Pharmacy role. */
function PharmacyDetailsCard() {
  const [details, setDetails] = useState<PharmacyDetails>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    pharmacyApi.getProfile().then(setDetails).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      await pharmacyApi.updateProfile(details as Record<string, unknown>);
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Card style={{ marginTop: 16, width: '100%' }}>
        <View style={styles.detailsHeader}>
          <Text style={styles.sectionTitle}>Pharmacy details</Text>
          <Pressable onPress={() => setEditing(true)}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
        <Field label="Pharmacy name" value={details.pharmacyName} />
        <Field label="Address" value={details.address} />
        <Field label="Operating hours" value={details.operatingHours} />
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 16, width: '100%' }}>
      <Text style={styles.sectionTitle}>Edit pharmacy details</Text>
      <TextInput style={styles.input} placeholder="Pharmacy name" value={details.pharmacyName ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, pharmacyName: v }))} />
      <TextInput style={styles.input} placeholder="Address" value={details.address ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, address: v }))} />
      <TextInput style={styles.input} placeholder="Operating hours (e.g. Mon-Sat 8am-8pm)" value={details.operatingHours ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, operatingHours: v }))} />
      <LocationCaptureButton lat={details.lat} lng={details.lng} onCaptured={(lat, lng) => setDetails((d) => ({ ...d, lat, lng }))} />
      <Button title="Save" onPress={save} loading={saving} style={{ marginTop: 16 }} />
      <Button title="Cancel" variant="outline" onPress={() => { setEditing(false); load(); }} style={{ marginTop: 10 }} />
    </Card>
  );
}

interface LabDetails {
  labName?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
}

/** Editable lab details, shown only for the Lab role. */
function LabDetailsCard() {
  const [details, setDetails] = useState<LabDetails>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    labApi.getProfile().then(setDetails).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      await labApi.updateProfile(details as Record<string, unknown>);
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Card style={{ marginTop: 16, width: '100%' }}>
        <View style={styles.detailsHeader}>
          <Text style={styles.sectionTitle}>Lab details</Text>
          <Pressable onPress={() => setEditing(true)}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
        <Field label="Lab name" value={details.labName} />
        <Field label="Address" value={details.address} />
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 16, width: '100%' }}>
      <Text style={styles.sectionTitle}>Edit lab details</Text>
      <TextInput style={styles.input} placeholder="Lab name" value={details.labName ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, labName: v }))} />
      <TextInput style={styles.input} placeholder="Address" value={details.address ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, address: v }))} />
      <LocationCaptureButton lat={details.lat} lng={details.lng} onCaptured={(lat, lng) => setDetails((d) => ({ ...d, lat, lng }))} />
      <Button title="Save" onPress={save} loading={saving} style={{ marginTop: 16 }} />
      <Button title="Cancel" variant="outline" onPress={() => { setEditing(false); load(); }} style={{ marginTop: 10 }} />
    </Card>
  );
}

interface AmbulanceDetails {
  vehicleNumber?: string;
}

/** Editable vehicle details, shown only for the Ambulance role. */
function AmbulanceDetailsCard() {
  const [details, setDetails] = useState<AmbulanceDetails>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    ambulanceApi.getProfile().then(setDetails).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      await ambulanceApi.updateProfile(details as Record<string, unknown>);
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Card style={{ marginTop: 16, width: '100%' }}>
        <View style={styles.detailsHeader}>
          <Text style={styles.sectionTitle}>Vehicle details</Text>
          <Pressable onPress={() => setEditing(true)}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
        <Field label="Vehicle number" value={details.vehicleNumber} />
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 16, width: '100%' }}>
      <Text style={styles.sectionTitle}>Edit vehicle details</Text>
      <TextInput style={styles.input} placeholder="Vehicle number" value={details.vehicleNumber ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, vehicleNumber: v }))} />
      <Button title="Save" onPress={save} loading={saving} />
      <Button title="Cancel" variant="outline" onPress={() => { setEditing(false); load(); }} style={{ marginTop: 10 }} />
    </Card>
  );
}

interface NurseDetails {
  specialty?: string;
  hourlyRate?: number;
}

/** Editable nurse details, shown only for the Nurse role. */
function NurseDetailsCard() {
  const [details, setDetails] = useState<NurseDetails>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rateInput, setRateInput] = useState('');

  const load = useCallback(() => {
    nurseApi.getProfile().then((p) => {
      setDetails({ specialty: p.specialty ?? undefined, hourlyRate: Number(p.hourlyRate) });
      setRateInput(String(Number(p.hourlyRate)));
    }).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      await nurseApi.updateProfile({ specialty: details.specialty, hourlyRate: Math.max(0, parseFloat(rateInput) || 0) });
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Card style={{ marginTop: 16, width: '100%' }}>
        <View style={styles.detailsHeader}>
          <Text style={styles.sectionTitle}>Nurse details</Text>
          <Pressable onPress={() => setEditing(true)}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
        <Field label="Specialty" value={details.specialty} />
        <Field label="Hourly rate" value={details.hourlyRate != null ? `₦${details.hourlyRate.toLocaleString()}` : undefined} />
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 16, width: '100%' }}>
      <Text style={styles.sectionTitle}>Edit nurse details</Text>
      <TextInput style={styles.input} placeholder="Specialty (e.g. Wound care)" value={details.specialty ?? ''} onChangeText={(v) => setDetails((d) => ({ ...d, specialty: v }))} />
      <TextInput style={styles.input} placeholder="Hourly rate (₦)" value={rateInput} onChangeText={setRateInput} keyboardType="decimal-pad" />
      <Button title="Save" onPress={save} loading={saving} />
      <Button title="Cancel" variant="outline" onPress={() => { setEditing(false); load(); }} style={{ marginTop: 10 }} />
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || 'Not set'}</Text>
    </View>
  );
}

/** Editable name/phone, shown for every role since these live on the shared User table. */
function AccountInfoCard() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const updated = await accountApi.updateAccount({ name: name.trim(), phone: phone.trim() || undefined });
      await updateUser({ name: updated.name, phone: updated.phone });
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (!editing) {
    return (
      <Card style={{ marginTop: 16, width: '100%' }}>
        <View style={styles.detailsHeader}>
          <Text style={styles.sectionTitle}>Account info</Text>
          <Pressable onPress={() => { setName(user.name); setPhone(user.phone ?? ''); setEditing(true); }}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
        <Field label="Name" value={user.name} />
        <Field label="Phone" value={user.phone ?? undefined} />
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 16, width: '100%' }}>
      <Text style={styles.sectionTitle}>Edit account info</Text>
      <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Phone (e.g. +234 800 000 0000)" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Button title="Save" onPress={save} loading={saving} />
      <Button title="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ marginTop: 10 }} />
    </Card>
  );
}

export function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  if (!user) return null;

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AvatarPicker
        name={user.name}
        avatarUrl={user.avatarUrl}
        color={roleColor[user.role]}
        onUploaded={(avatarUrl) => updateUser({ avatarUrl })}
      />
      <Text style={styles.name}>{user.name}</Text>
      <Text style={[styles.role, { color: roleColor[user.role] }]}>{ROLE_LABEL[user.role]}</Text>

      <AccountInfoCard />

      <Card style={{ marginTop: 24, width: '100%' }}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user.email}</Text>
      </Card>

      {user.role === 'PATIENT' && <PatientDetailsCard />}
      {user.role === 'DOCTOR' && <DoctorDetailsCard />}
      {user.role === 'PHARMACY' && <PharmacyDetailsCard />}
      {user.role === 'LAB' && <LabDetailsCard />}
      {user.role === 'AMBULANCE' && <AmbulanceDetailsCard />}
      {user.role === 'NURSE' && <NurseDetailsCard />}

      <Button title="Log Out" variant="danger" onPress={confirmLogout} style={{ marginTop: 24, width: '100%' }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.surface, alignItems: 'center', padding: 24, paddingTop: 48 },
  avatarWrap: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 16 },
  role: { fontSize: 14, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 15, color: colors.textPrimary, marginTop: 4 },
  detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  editLink: { color: colors.primary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: radius.sm, padding: 12, marginBottom: 10, marginTop: 4 },
});
