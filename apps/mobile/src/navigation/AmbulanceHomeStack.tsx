import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AmbulanceHomeScreen } from '../screens/ambulance/HomeScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function AmbulanceHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="HomeMain" component={AmbulanceHomeScreen} options={{ title: 'N-Health', headerShown: false }} />
    </Stack.Navigator>
  );
}
