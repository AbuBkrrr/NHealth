import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LabTestsScreen } from '../screens/lab/TestsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function LabTestsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="TestsMain" component={LabTestsScreen} options={{ title: 'Test Requests' }} />
    </Stack.Navigator>
  );
}
