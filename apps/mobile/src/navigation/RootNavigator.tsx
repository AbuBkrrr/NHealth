import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { PatientNavigator } from './PatientNavigator';
import { AmbulanceNavigator } from './AmbulanceNavigator';
import { DoctorNavigator } from './DoctorNavigator';
import { LabNavigator } from './LabNavigator';
import { NurseNavigator } from './NurseNavigator';
import { PharmacyNavigator } from './PharmacyNavigator';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { colors } from '../theme/colors';

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  function renderForRole() {
    switch (user?.role) {
      case 'PATIENT':
        return <PatientNavigator />;
      case 'DOCTOR':
        return <DoctorNavigator />;
      case 'PHARMACY':
        return <PharmacyNavigator />;
      case 'LAB':
        return <LabNavigator />;
      case 'AMBULANCE':
        return <AmbulanceNavigator />;
      case 'NURSE':
        return <NurseNavigator />;
      default:
        return <ComingSoonScreen />;
    }
  }

  return <NavigationContainer>{!user ? <AuthNavigator /> : renderForRole()}</NavigationContainer>;
}
