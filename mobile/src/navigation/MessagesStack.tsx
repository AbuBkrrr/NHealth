import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConversationsScreen } from '../screens/shared/ConversationsScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function MessagesStack() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerStyle: { backgroundColor: colors.white }, 
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen 
        name="Conversations" 
        component={ConversationsScreen} 
        options={{ 
          title: 'Messages',
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={({ route }: any) => ({
          title: route.params?.name || 'Chat',
        })}
      />
    </Stack.Navigator>
  );
}
