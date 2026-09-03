import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DoctorHomeScreen } from '../screens/doctor/HomeScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function DoctorHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="HomeMain" component={DoctorHomeScreen} options={{ title: 'N-Health', headerShown: false }} />
    </Stack.Navigator>
  );
}
