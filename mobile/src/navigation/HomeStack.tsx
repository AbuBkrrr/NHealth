import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PatientHomeScreen } from '../screens/patient/HomeScreen';
import { PatientEmergencyScreen } from '../screens/patient/EmergencyScreen';
import { ProvidersScreen } from '../screens/patient/ProvidersScreen';
import { LabsScreen } from '../screens/patient/LabsScreen';
import { DonationsScreen } from '../screens/patient/DonationsScreen';
import { InsuranceScreen } from '../screens/patient/InsuranceScreen';
import { PatientAppointmentsScreen } from '../screens/patient/AppointmentsScreen';
import { OrderHistoryScreen } from '../screens/patient/OrderHistoryScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

const headerOptions = { 
  headerStyle: { backgroundColor: colors.white }, 
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '600' },
};

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen 
        name="HomeMain" 
        component={PatientHomeScreen} 
        options={{ 
          title: 'N-Health', 
          headerShown: true,
        }} 
      />
      <Stack.Screen name="Emergency" component={PatientEmergencyScreen} options={{ title: 'Emergency Request' }} />
      <Stack.Screen name="Appointments" component={PatientAppointmentsScreen} options={{ title: 'My Appointments' }} />
      <Stack.Screen name="Providers" component={ProvidersScreen} options={{ title: 'Find Care' }} />
      <Stack.Screen name="Labs" component={LabsScreen} options={{ title: 'Lab Tests' }} />
      <Stack.Screen name="Donate" component={DonationsScreen} options={{ title: 'Make a Donation' }} />
      <Stack.Screen name="Insurance" component={InsuranceScreen} options={{ title: 'Insurance Policies' }} />
      <Stack.Screen name="Fund" component={OrderHistoryScreen} options={{ title: 'Fund Wallet' }} />
      <Stack.Screen name="History" component={OrderHistoryScreen} options={{ title: 'Transaction History' }} />
    </Stack.Navigator>
  );
}
