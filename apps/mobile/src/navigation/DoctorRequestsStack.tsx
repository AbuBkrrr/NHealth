import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DoctorRequestsScreen } from '../screens/doctor/RequestsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function DoctorRequestsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="RequestsMain" component={DoctorRequestsScreen} options={{ title: 'Appointments' }} />
    </Stack.Navigator>
  );
}
