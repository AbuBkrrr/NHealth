import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { NurseHomeStack } from './NurseHomeStack';
import { NurseRequestsStack } from './NurseRequestsStack';
import { NursePaymentsStack } from './NursePaymentsStack';
import { MessagesStack } from './MessagesStack';
import { ProfileStack } from './ProfileStack';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Home: '🏠',
  Requests: '🩺',
  Payments: '💰',
  Messages: '💬',
  Profile: '👤',
};

export function NurseNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.nurse,
        tabBarInactiveTintColor: colors.textLight,
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={NurseHomeStack} />
      <Tab.Screen name="Requests" component={NurseRequestsStack} />
      <Tab.Screen name="Payments" component={NursePaymentsStack} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
