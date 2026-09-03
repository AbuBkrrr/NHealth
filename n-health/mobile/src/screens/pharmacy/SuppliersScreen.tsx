import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { pharmacyApi, Supplier } from '../../api/pharmacy';
import { Card, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors, radius } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';

const EMPTY_FORM = { name: '', contact: '', email: '' };

export function PharmacySuppliersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    pharmacyApi.listSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing info', 'Supplier name is required.');
      return;
    }
    setSaving(true);
    try {
      await pharmacyApi.createSupplier({
        name: form.name.trim(),
        contact: form.contact.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setModalVisible(false);
      load();
    } catch (err: any) {
      Alert.alert('Could not add supplier', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = (supplier: Supplier) => {
    Alert.alert('Remove supplier', `Remove "${supplier.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await pharmacyApi.deleteSupplier(supplier.id);
            load();
          } catch (err: any) {
            Alert.alert('Could not remove supplier', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        data={suppliers}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={<EmptyState icon="🚚" title="No suppliers yet" subtitle="Add suppliers to link them to your inventory." />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.contact ? <Text style={styles.meta}>{item.contact}</Text> : null}
                {item.email ? <Text style={styles.meta}>{item.email}</Text> : null}
                <Text style={styles.meta}>{item._count?.items ?? 0} item(s) supplied</Text>
              </View>
              <Pressable onPress={() => remove(item)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add supplier</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Supplier name" />
            <Text style={styles.label}>Contact phone</Text>
            <TextInput style={styles.input} value={form.contact} onChangeText={(v) => setForm((f) => ({ ...f, contact: v }))} placeholder="Phone number" keyboardType="phone-pad" />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" />
            <Button title="Add supplier" onPress={save} loading={saving} style={{ marginTop: 16 }} />
            <Button title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  remove: { fontSize: 13, fontWeight: '600', color: colors.error },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.pharmacy, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '600', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.textPrimary },
});
