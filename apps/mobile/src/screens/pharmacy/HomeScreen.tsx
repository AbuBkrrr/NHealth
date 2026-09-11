import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { pharmacyApi, PharmacyStats, PharmacyOrder } from '../../api/pharmacy';
import { Card, StatusBadge, EmptyState } from '../../components/Card';
import { colors } from '../../theme/colors';

export function PharmacyHomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [stats, setStats] = useState<PharmacyStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<PharmacyOrder[]>([]);

  const load = useCallback(() => {
    pharmacyApi.getStats().then(setStats).catch(() => {});
    pharmacyApi.listOrders('PENDING').then((orders) => setRecentOrders(orders.slice(0, 5))).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.greeting}>Welcome back 👋</Text>
      <Text style={styles.subGreeting}>{user?.name}</Text>

      <View style={styles.statsGrid}>
        <Pressable style={styles.statTile} onPress={() => navigation.navigate('Orders')}>
          <Text style={styles.statNumber}>{stats?.pendingOrders ?? '—'}</Text>
          <Text style={styles.statLabel}>Pending orders</Text>
        </Pressable>
        <Pressable style={styles.statTile} onPress={() => navigation.navigate('Inventory')}>
          <Text style={[styles.statNumber, (stats?.lowStockCount ?? 0) > 0 && { color: colors.error }]}>
            {stats?.lowStockCount ?? '—'}
          </Text>
          <Text style={styles.statLabel}>Low stock items</Text>
        </Pressable>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{stats?.totalItems ?? '—'}</Text>
          <Text style={styles.statLabel}>Products listed</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>₦{(stats?.todayRevenue ?? 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>Today's revenue</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>New orders</Text>
      {recentOrders.length === 0 ? (
        <Card>
          <EmptyState icon="📦" title="No pending orders" subtitle="New patient orders will show up here." />
        </Card>
      ) : (
        recentOrders.map((o) => (
          <Pressable key={o.id} onPress={() => navigation.navigate('Orders')}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.orderPatient}>{o.patient.user.name}</Text>
                <StatusBadge status={o.status} />
              </View>
              <Text style={styles.meta}>{o.items.length} item{o.items.length === 1 ? '' : 's'} · ₦{Number(o.total).toLocaleString()}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subGreeting: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statTile: { width: '47%', backgroundColor: colors.white, borderRadius: 16, padding: 18, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800', color: colors.pharmacy },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderPatient: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
