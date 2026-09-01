import React, { useState } from 'react';
import { Text, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Button } from './Button';

interface LocationCaptureButtonProps {
  lat?: number | null;
  lng?: number | null;
  onCaptured: (lat: number, lng: number) => void;
}

/** Lets a provider (doctor/pharmacy/lab) set their fixed location from their
 * current device GPS position, for use in patients' proximity-sorted directory. */
export function LocationCaptureButton({ lat, lng, onCaptured }: LocationCaptureButtonProps) {
  const [capturing, setCapturing] = useState(false);

  const capture = async () => {
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need your location to set where patients will find you.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      onCaptured(position.coords.latitude, position.coords.longitude);
    } catch {
      Alert.alert('Could not get location', 'Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      <Button
        title={lat != null && lng != null ? '📍 Update location from GPS' : '📍 Set location from GPS'}
        variant="outline"
        onPress={capture}
        loading={capturing}
        style={{ marginTop: 8 }}
      />
      {lat != null && lng != null && (
        <Text style={{ fontSize: 12, color: '#888', marginTop: 6, textAlign: 'center' }}>
          Location set - patients searching nearby will see you sorted by distance.
        </Text>
      )}
    </>
  );
}
