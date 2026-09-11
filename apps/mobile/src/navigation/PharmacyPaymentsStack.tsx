import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PharmacyPaymentsScreen } from '../screens/pharmacy/PaymentsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function PharmacyPaymentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="PaymentsMain" component={PharmacyPaymentsScreen} options={{ title: 'Payments' }} />
    </Stack.Navigator>
  );
}
