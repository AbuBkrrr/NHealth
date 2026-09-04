import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PharmacyHomeScreen } from '../screens/pharmacy/HomeScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function PharmacyHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="HomeMain" component={PharmacyHomeScreen} options={{ title: 'N-Health', headerShown: false }} />
    </Stack.Navigator>
  );
}
