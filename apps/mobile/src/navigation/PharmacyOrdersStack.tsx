import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PharmacyOrdersScreen } from '../screens/pharmacy/OrdersScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function PharmacyOrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="OrdersMain" component={PharmacyOrdersScreen} options={{ title: 'Orders' }} />
    </Stack.Navigator>
  );
}
