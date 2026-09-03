import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AmbulanceRequestsScreen } from '../screens/ambulance/RequestsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function AmbulanceRequestsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="RequestsMain" component={AmbulanceRequestsScreen} options={{ title: 'Emergency Calls' }} />
    </Stack.Navigator>
  );
}
