import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PatientHomeScreen } from '../screens/patient/HomeScreen';
import { PatientEmergencyScreen } from '../screens/patient/EmergencyScreen';
import { ProvidersScreen } from '../screens/patient/ProvidersScreen';
import { LabsScreen } from '../screens/patient/LabsScreen';
import { DonationsScreen } from '../screens/patient/DonationsScreen';
import { InsuranceScreen } from '../screens/patient/InsuranceScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

const headerOptions = { headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary };

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="HomeMain" component={PatientHomeScreen} options={{ title: 'N-Health', headerShown: false }} />
      <Stack.Screen name="Emergency" component={PatientEmergencyScreen} options={{ title: 'Emergency' }} />
      <Stack.Screen name="Providers" component={ProvidersScreen} options={{ title: 'Find Care' }} />
      <Stack.Screen name="Labs" component={LabsScreen} options={{ title: 'Lab Tests' }} />
      <Stack.Screen name="Donations" component={DonationsScreen} options={{ title: 'Donations' }} />
      <Stack.Screen name="Insurance" component={InsuranceScreen} options={{ title: 'Insurance' }} />
    </Stack.Navigator>
  );
}
