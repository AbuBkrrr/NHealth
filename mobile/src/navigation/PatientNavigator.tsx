import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { HomeStack } from './HomeStack';
import { AppointmentsStack } from './AppointmentsStack';
import { PharmacyStack } from './PharmacyStack';
import { MessagesStack } from './MessagesStack';
import { ProfileStack } from './ProfileStack';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Home: '🏠',
  Appointments: '🩺',
  Pharmacy: '💊',
  Messages: '💬',
  Profile: '👤',
};

export function PatientNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Appointments" component={AppointmentsStack} />
      <Tab.Screen name="Pharmacy" component={PharmacyStack} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
