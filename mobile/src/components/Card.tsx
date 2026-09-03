import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../theme/colors';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: colors.warning,
  CONFIRMED: colors.primary,
  IN_PROGRESS: colors.primary,
  COMPLETED: colors.success,
  DELIVERED: colors.success,
  CANCELLED: colors.error,
  REQUESTED: colors.warning,
  ACCEPTED: colors.primary,
  EN_ROUTE: colors.ambulance,
  ARRIVED: colors.success,
  PROCESSING: colors.primary,
  READY: colors.success,
  ACTIVE: colors.success,
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.badgeText, { color }]}>{status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      {icon ? <Text style={styles.emptyIcon}>{icon}</Text> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
});
