import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NursePaymentsScreen } from '../screens/nurse/PaymentsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function NursePaymentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="PaymentsMain" component={NursePaymentsScreen} options={{ title: 'Payments' }} />
    </Stack.Navigator>
  );
}
