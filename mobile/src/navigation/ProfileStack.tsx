import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function ProfileStack() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerStyle: { backgroundColor: colors.white }, 
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen 
        name="ProfileMain" 
        component={ProfileScreen} 
        options={{ 
          title: 'Profile',
          headerShown: true,
        }} 
      />
    </Stack.Navigator>
  );
}
