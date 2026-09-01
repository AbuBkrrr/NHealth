import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NurseRequestsScreen } from '../screens/nurse/RequestsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function NurseRequestsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="RequestsMain" component={NurseRequestsScreen} options={{ title: 'Visit Requests' }} />
    </Stack.Navigator>
  );
}
