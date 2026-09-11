import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useIsOffline } from '../hooks/useNetworkStatus';
import { colors } from '../theme/colors';

export function OfflineBanner() {
  const isOffline = useIsOffline();
  if (!isOffline) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.banner}>
        <Text style={styles.text}>No internet connection</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  banner: { backgroundColor: colors.warning, paddingVertical: 6, alignItems: 'center' },
  text: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
});
