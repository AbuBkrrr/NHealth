import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DoctorPatientsScreen } from '../screens/doctor/PatientsScreen';
import { PatientDetailScreen } from '../screens/doctor/PatientDetailScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function DoctorPatientsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="PatientsMain" component={DoctorPatientsScreen} options={{ title: 'My Patients' }} />
      <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
    </Stack.Navigator>
  );
}
