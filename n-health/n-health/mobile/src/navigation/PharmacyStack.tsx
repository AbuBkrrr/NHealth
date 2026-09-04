import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PharmacyScreen } from '../screens/patient/PharmacyScreen';
import { OrderHistoryScreen } from '../screens/patient/OrderHistoryScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function PharmacyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="PharmacyMain" component={PharmacyScreen} options={{ title: 'Pharmacy' }} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} options={{ title: 'My Orders' }} />
    </Stack.Navigator>
  );
}
