import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OfflineBanner } from './src/components/OfflineBanner';

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <OfflineBanner />
      <RootNavigator />
    </AuthProvider>
  );
}
