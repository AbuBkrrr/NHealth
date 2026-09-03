import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Pressable } from 'react-native';
import { providerApi, patientApi } from '../../api/patient';
import { Card, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { PaymentModal } from '../../components/PaymentModal';
import { colors, radius } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { useUserLocation } from '../../hooks/useUserLocation';

interface Pharmacy { id: string; pharmacyName: string; address?: string; operatingHours?: string; distanceKm?: number; }
interface InventoryItem { id: string; name: string; category?: string; price: string; stock: number; }
interface CartLine extends InventoryItem { qty: number; }

export function PharmacyScreen({ navigation }: any) {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selected, setSelected] = useState<Pharmacy | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [placing, setPlacing] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const location = useUserLocation();

  useEffect(() => {
    providerApi.listPharmacies(location).then(setPharmacies).catch(() => {});
  }, [location]);

  const openPharmacy = async (p: Pharmacy) => {
    setSelected(p);
    setCart({});
    const inv = await providerApi.pharmacyInventory(p.id);
    setItems(inv);
  };

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const existing = prev[item.id];
      return { ...prev, [item.id]: { ...item, qty: (existing?.qty ?? 0) + 1 } };
    });
  };

  const cartLines = Object.values(cart);
  const total = cartLines.reduce((sum, l) => sum + l.qty * Number(l.price), 0);

  const checkout = async () => {
    if (!selected || cartLines.length === 0) return;
    setPlacing(true);
    try {
      const order = await patientApi.createOrder({
        pharmacyId: selected.id,
        items: cartLines.map((l) => ({ inventoryId: l.id, name: l.name, qty: l.qty, price: Number(l.price) })),
      });
      setCart({});
      setPendingOrderId(order.id);
    } catch (err: any) {
      Alert.alert('Order failed', getErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  };

  if (selected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>← Pharmacies</Text></Pressable>
          <Text style={styles.pharmacyTitle}>{selected.pharmacyName}</Text>
        </View>
        <FlatList
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          data={items}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<EmptyState icon="💊" title="No items in stock right now" />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{item.category} · {item.stock} in stock</Text>
                  <Text style={styles.itemPrice}>₦{Number(item.price).toLocaleString()}</Text>
                </View>
                <Button title={cart[item.id] ? `Added (${cart[item.id].qty})` : 'Add'} onPress={() => addToCart(item)} variant={cart[item.id] ? 'outline' : 'primary'} />
              </View>
            </Card>
          )}
        />
        {cartLines.length > 0 && (
          <View style={styles.checkoutBar}>
            <Text style={styles.total}>Total: ₦{total.toLocaleString()}</Text>
            <Button title="Checkout" onPress={checkout} loading={placing} />
          </View>
        )}

        {pendingOrderId && (
          <PaymentModal
            visible={!!pendingOrderId}
            payableType="PHARMACY_ORDER"
            payableId={pendingOrderId}
            label={`order from ${selected.pharmacyName}`}
            onConfirmed={() => Alert.alert('Order confirmed', 'Your pharmacy has received your payment and is preparing your order.')}
            onClose={() => {
              setPendingOrderId(null);
              setSelected(null);
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={pharmacies}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <Button
            title="🧾 View My Orders"
            variant="outline"
            onPress={() => navigation.navigate('OrderHistory')}
            style={{ marginBottom: 16 }}
          />
        }
        ListEmptyComponent={<EmptyState icon="💊" title="No pharmacies available yet" />}
        renderItem={({ item }) => (
          <Pressable onPress={() => openPharmacy(item)}>
            <Card>
              <Text style={styles.itemName}>{item.pharmacyName}</Text>
              {item.address ? <Text style={styles.itemMeta}>{item.address}</Text> : null}
              {item.operatingHours ? <Text style={styles.itemMeta}>{item.operatingHours}</Text> : null}
              {item.distanceKm !== undefined && (
                <Text style={styles.itemMeta}>📍 {item.distanceKm < 1 ? '<1' : item.distanceKm.toFixed(1)} km away</Text>
              )}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.white, padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  back: { color: colors.primary, fontWeight: '600', marginBottom: 8 },
  pharmacyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center' },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  itemMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: colors.pharmacy, marginTop: 4 },
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
});
