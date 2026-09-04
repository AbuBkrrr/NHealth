import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { pharmacyApi, PharmacyOrder, OrderStatus } from '../../api/pharmacy';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/errorMessage';
import { useSocket } from '../../hooks/useSocket';

const FILTERS: { key: 'ACTIVE' | OrderStatus; label: string }[] = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

// The next forward action a pharmacy can take on an order, keyed by its current status.
const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  PENDING: { label: 'Start Processing', next: 'PROCESSING' },
  PROCESSING: { label: 'Mark Ready', next: 'READY' },
  READY: { label: 'Out for Delivery', next: 'OUT_FOR_DELIVERY' },
  OUT_FOR_DELIVERY: { label: 'Mark Delivered', next: 'DELIVERED' },
};

function OrderRow({ order, onChanged }: { order: PharmacyOrder; onChanged: () => void }) {
  const [acting, setActing] = useState(false);
  const action = NEXT_ACTION[order.status];
  const canCancel = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';

  const setStatus = async (status: OrderStatus) => {
    setActing(true);
    try {
      await pharmacyApi.updateOrderStatus(order.id, status);
      onChanged();
    } catch (err: any) {
      Alert.alert('Could not update order', getErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const cancel = () => {
    Alert.alert('Cancel order', 'Cancel this order and restock the items?', [
      { text: 'Keep order', style: 'cancel' },
      { text: 'Cancel order', style: 'destructive', onPress: () => setStatus('CANCELLED') },
    ]);
  };

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.patient}>{order.patient.user.name}</Text>
        <StatusBadge status={order.status} />
      </View>
      <Text style={styles.meta}>{new Date(order.createdAt).toLocaleString()}</Text>
      {order.items.map((it, idx) => (
        <Text key={idx} style={styles.itemLine}>· {it.qty}× {it.name}</Text>
      ))}
      <View style={styles.row}>
        <Text style={styles.total}>Total: ₦{Number(order.total).toLocaleString()}</Text>
        <Text style={[styles.paymentTag, order.paymentStatus === 'PAID' ? styles.paid : styles.unpaid]}>
          {order.paymentStatus === 'PAID' ? 'Paid' : 'Awaiting payment'}
        </Text>
      </View>

      {action && (
        <View style={styles.actionsRow}>
          <Button
            title={action.label}
            onPress={() => setStatus(action.next)}
            loading={acting}
            disabled={order.paymentStatus !== 'PAID'}
            style={{ flex: 1, marginRight: canCancel ? 8 : 0 }}
          />
          {canCancel && (
            <Button title="Cancel" variant="outline" onPress={cancel} loading={acting} style={{ flex: 1 }} />
          )}
        </View>
      )}
      {action && order.paymentStatus !== 'PAID' && (
        <Text style={styles.waitingNote}>Waiting for the patient's payment to be confirmed.</Text>
      )}
    </Card>
  );
}

export function PharmacyOrdersScreen() {
  const [filter, setFilter] = useState<'ACTIVE' | OrderStatus>('ACTIVE');
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);

  const load = useCallback(() => {
    const status = filter === 'ACTIVE' ? undefined : filter;
    pharmacyApi.listOrders(status).then(setOrders).catch(() => {});
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocket({ 'payment:confirmed': load, 'order:updated': load });

  const shown = filter === 'ACTIVE'
    ? orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
    : orders;

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
        data={shown}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={<EmptyState icon="📦" title="No orders here" />}
        renderItem={({ item }) => <OrderRow order={item} onChanged={load} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.white, padding: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: colors.pharmacyLight },
  tabText: { fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.pharmacy },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  patient: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: 8 },
  itemLine: { fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  total: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 10 },
  paymentTag: { fontSize: 11, fontWeight: '700', marginTop: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  paid: { color: colors.success, backgroundColor: colors.success + '22' },
  unpaid: { color: colors.warning, backgroundColor: colors.warning + '22' },
  actionsRow: { flexDirection: 'row', marginTop: 12 },
  waitingNote: { fontSize: 12, color: colors.textLight, marginTop: 8, fontStyle: 'italic' },
});
