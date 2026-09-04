import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LabPaymentsScreen } from '../screens/lab/PaymentsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function LabPaymentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="PaymentsMain" component={LabPaymentsScreen} options={{ title: 'Payments' }} />
    </Stack.Navigator>
  );
}
