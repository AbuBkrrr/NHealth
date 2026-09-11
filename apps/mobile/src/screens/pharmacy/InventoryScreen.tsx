import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { pharmacyApi, InventoryItem, Supplier } from '../../api/pharmacy';
import { Card, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors, radius } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';

interface FormState {
  id?: string;
  name: string;
  category: string;
  stock: string;
  price: string;
  supplierId: string | null;
}

const EMPTY_FORM: FormState = { name: '', category: '', stock: '', price: '', supplierId: null };

export function PharmacyInventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    pharmacyApi.listInventory().then(setItems).catch(() => {});
    pharmacyApi.listSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (item: InventoryItem) => {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category ?? '',
      stock: String(item.stock),
      price: String(item.price),
      supplierId: item.supplierId ?? null,
    });
    setModalVisible(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.stock.trim() || !form.price.trim()) {
      Alert.alert('Missing info', 'Name, stock and price are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        stock: Math.max(0, parseInt(form.stock, 10) || 0),
        price: Math.max(0, parseFloat(form.price) || 0),
        supplierId: form.supplierId,
      };
      if (form.id) {
        await pharmacyApi.updateInventoryItem(form.id, payload);
      } else {
        await pharmacyApi.createInventoryItem(payload);
      }
      setModalVisible(false);
      load();
    } catch (err: any) {
      Alert.alert('Could not save item', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: InventoryItem) => {
    Alert.alert('Remove item', `Remove "${item.name}" from inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await pharmacyApi.deleteInventoryItem(item.id);
            load();
          } catch (err: any) {
            Alert.alert('Could not remove item', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        data={items}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={
          <EmptyState icon="💊" title="No products yet" subtitle="Add your first item to start taking orders." />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.category ? <Text style={styles.meta}>{item.category}</Text> : null}
                {item.supplier ? <Text style={styles.meta}>Supplier: {item.supplier.name}</Text> : null}
              </View>
              <Text style={styles.price}>₦{Number(item.price).toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.stock, item.stock <= 5 && styles.stockLow]}>
                {item.stock <= 5 ? '⚠️ ' : ''}{item.stock} in stock
              </Text>
              <View style={styles.actions}>
                <Pressable onPress={() => openEdit(item)}><Text style={styles.link}>Edit</Text></Pressable>
                <Pressable onPress={() => remove(item)}><Text style={[styles.link, { color: colors.error }]}>Remove</Text></Pressable>
              </View>
            </View>
          </Card>
        )}
      />

      <Pressable style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{form.id ? 'Edit product' : 'Add product'}</Text>

              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Paracetamol 500mg" />

              <Text style={styles.label}>Category</Text>
              <TextInput style={styles.input} value={form.category} onChangeText={(v) => setForm((f) => ({ ...f, category: v }))} placeholder="e.g. Painkillers" />

              <Text style={styles.label}>Stock</Text>
              <TextInput style={styles.input} value={form.stock} onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))} keyboardType="number-pad" placeholder="0" />

              <Text style={styles.label}>Price (₦)</Text>
              <TextInput style={styles.input} value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v }))} keyboardType="decimal-pad" placeholder="0" />

              {suppliers.length > 0 && (
                <>
                  <Text style={styles.label}>Supplier</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <Pressable
                      style={[styles.chip, !form.supplierId && styles.chipActive]}
                      onPress={() => setForm((f) => ({ ...f, supplierId: null }))}
                    >
                      <Text style={[styles.chipText, !form.supplierId && styles.chipTextActive]}>None</Text>
                    </Pressable>
                    {suppliers.map((s) => (
                      <Pressable
                        key={s.id}
                        style={[styles.chip, form.supplierId === s.id && styles.chipActive]}
                        onPress={() => setForm((f) => ({ ...f, supplierId: s.id }))}
                      >
                        <Text style={[styles.chipText, form.supplierId === s.id && styles.chipTextActive]}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

              <Button title={form.id ? 'Save changes' : 'Add product'} onPress={save} loading={saving} style={{ marginTop: 16 }} />
              <Button title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={{ marginTop: 10 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  price: { fontSize: 16, fontWeight: '800', color: colors.pharmacy },
  stock: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  stockLow: { color: colors.error, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  link: { fontSize: 13, fontWeight: '600', color: colors.primary },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.pharmacy, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '600', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.textPrimary },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, marginRight: 8 },
  chipActive: { backgroundColor: colors.pharmacyLight },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.pharmacy },
});
