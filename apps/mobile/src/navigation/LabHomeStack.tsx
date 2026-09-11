import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LabHomeScreen } from '../screens/lab/HomeScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function LabHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="HomeMain" component={LabHomeScreen} options={{ title: 'N-Health', headerShown: false }} />
    </Stack.Navigator>
  );
}
