import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useAuth, Role } from '../../context/AuthContext';
import { Button } from '../../components/Button';
import { colors, radius, roleColor } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';

const ROLES: { key: Role; label: string }[] = [
  { key: 'PATIENT', label: 'Patient' },
  { key: 'DOCTOR', label: 'Doctor' },
  { key: 'PHARMACY', label: 'Pharmacy' },
  { key: 'LAB', label: 'Lab' },
  { key: 'AMBULANCE', label: 'Ambulance' },
  { key: 'NURSE', label: 'Nurse' },
];

export function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('PATIENT');
  const [genotype, setGenotype] = useState('');
  const [nhisNumber, setNhisNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!name || !email || password.length < 8) {
      Alert.alert('Missing info', 'Please fill in your name, email, and a password of at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({
        name,
        email,
        phone: phone || undefined,
        password,
        role,
        profile: role === 'PATIENT' ? { genotype: genotype || undefined, nhisNumber: nhisNumber || undefined } : undefined,
      });
    } catch (err: any) {
      Alert.alert('Registration failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create your account</Text>

      <Text style={styles.label}>I am a...</Text>
      <View style={styles.roleGrid}>
        {ROLES.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => setRole(r.key)}
            style={[
              styles.roleChip,
              { borderColor: role === r.key ? roleColor[r.key] : '#E0E0E0', backgroundColor: role === r.key ? roleColor[r.key] + '18' : '#fff' },
            ]}
          >
            <Text style={{ color: role === r.key ? roleColor[r.key] : colors.textSecondary, fontWeight: '600' }}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Phone (e.g. +234 800 000 0000)" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <TextInput style={styles.input} placeholder="Password (min 8 characters)" secureTextEntry value={password} onChangeText={setPassword} />

      {role === 'PATIENT' && (
        <>
          <TextInput style={styles.input} placeholder="Genotype (optional, e.g. AA)" value={genotype} onChangeText={setGenotype} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="NHIS number (optional)" value={nhisNumber} onChangeText={setNhisNumber} />
        </>
      )}

      <Button title="Create Account" onPress={onSubmit} loading={loading} style={{ marginTop: 8 }} />

      <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: 20 }}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: colors.white, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 20, marginTop: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  roleChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, marginRight: 8, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: radius.sm, padding: 14, marginBottom: 12, fontSize: 16 },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
});
