import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PatientAppointmentsScreen } from '../screens/patient/AppointmentsScreen';
import { PrescriptionsScreen } from '../screens/patient/PrescriptionsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function AppointmentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="AppointmentsMain" component={PatientAppointmentsScreen} options={{ title: 'Appointments' }} />
      <Stack.Screen name="Prescriptions" component={PrescriptionsScreen} options={{ title: 'Prescriptions' }} />
    </Stack.Navigator>
  );
}
