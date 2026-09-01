import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { PharmacyHomeStack } from './PharmacyHomeStack';
import { PharmacyOrdersStack } from './PharmacyOrdersStack';
import { PharmacyInventoryStack } from './PharmacyInventoryStack';
import { PharmacySuppliersStack } from './PharmacySuppliersStack';
import { PharmacyPaymentsStack } from './PharmacyPaymentsStack';
import { MessagesStack } from './MessagesStack';
import { ProfileStack } from './ProfileStack';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Home: '🏠',
  Orders: '📦',
  Inventory: '💊',
  Suppliers: '🚚',
  Payments: '💰',
  Messages: '💬',
  Profile: '👤',
};

export function PharmacyNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.pharmacy,
        tabBarInactiveTintColor: colors.textLight,
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={PharmacyHomeStack} />
      <Tab.Screen name="Orders" component={PharmacyOrdersStack} />
      <Tab.Screen name="Inventory" component={PharmacyInventoryStack} />
      <Tab.Screen name="Suppliers" component={PharmacySuppliersStack} />
      <Tab.Screen name="Payments" component={PharmacyPaymentsStack} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
