import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { DoctorHomeStack } from './DoctorHomeStack';
import { DoctorRequestsStack } from './DoctorRequestsStack';
import { DoctorPatientsStack } from './DoctorPatientsStack';
import { DoctorPaymentsStack } from './DoctorPaymentsStack';
import { MessagesStack } from './MessagesStack';
import { ProfileStack } from './ProfileStack';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Home: '🏠',
  Requests: '🩺',
  Patients: '👥',
  Payments: '💰',
  Messages: '💬',
  Profile: '👤',
};

export function DoctorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.doctor,
        tabBarInactiveTintColor: colors.textLight,
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={DoctorHomeStack} />
      <Tab.Screen name="Requests" component={DoctorRequestsStack} />
      <Tab.Screen name="Patients" component={DoctorPatientsStack} />
      <Tab.Screen name="Payments" component={DoctorPaymentsStack} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
