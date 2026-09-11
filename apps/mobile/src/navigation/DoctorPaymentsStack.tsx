import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DoctorPaymentsScreen } from '../screens/doctor/PaymentsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function DoctorPaymentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="PaymentsMain" component={DoctorPaymentsScreen} options={{ title: 'Payments' }} />
    </Stack.Navigator>
  );
}
