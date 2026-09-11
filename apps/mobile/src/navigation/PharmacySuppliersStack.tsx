import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PharmacySuppliersScreen } from '../screens/pharmacy/SuppliersScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function PharmacySuppliersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="SuppliersMain" component={PharmacySuppliersScreen} options={{ title: 'Suppliers' }} />
    </Stack.Navigator>
  );
}
