import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NurseHomeScreen } from '../screens/nurse/HomeScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function NurseHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="HomeMain" component={NurseHomeScreen} options={{ title: 'N-Health', headerShown: false }} />
    </Stack.Navigator>
  );
}
