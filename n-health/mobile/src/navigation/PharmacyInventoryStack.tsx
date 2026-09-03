import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PharmacyInventoryScreen } from '../screens/pharmacy/InventoryScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function PharmacyInventoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="InventoryMain" component={PharmacyInventoryScreen} options={{ title: 'Inventory' }} />
    </Stack.Navigator>
  );
}
