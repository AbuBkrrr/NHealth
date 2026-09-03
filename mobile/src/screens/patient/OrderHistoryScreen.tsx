import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { patientApi, PharmacyOrder } from '../../api/patient';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { downloadAndSharePdf } from '../../utils/downloadPdf';

export function OrderHistoryScreen() {
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    patientApi.listOrders().then(setOrders).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      data={orders}
      keyExtractor={(o) => o.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState icon="🧾" title="No orders yet" subtitle="Orders you place from a pharmacy will show up here." />}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.row}>
            <Text style={styles.pharmacyName}>{item.pharmacy.user.name}</Text>
            <StatusBadge status={item.status} />
          </View>
          {item.items.map((line, i) => (
            <Text key={i} style={styles.line}>
              {line.qty}x {line.name} — ₦{(line.qty * line.price).toLocaleString()}
            </Text>
          ))}
          <Text style={styles.total}>Total: ₦{Number(item.total).toLocaleString()}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
          <Button
            title="Download Invoice"
            variant="outline"
            onPress={() => downloadAndSharePdf(`/patient/orders/${item.id}/invoice.pdf`, `invoice-${item.id.slice(0, 8)}.pdf`)}
            style={{ marginTop: 10 }}
          />
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pharmacyName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  line: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  total: { fontSize: 15, fontWeight: '700', color: colors.pharmacy, marginTop: 8 },
  date: { fontSize: 12, color: colors.textLight, marginTop: 4 },
});
