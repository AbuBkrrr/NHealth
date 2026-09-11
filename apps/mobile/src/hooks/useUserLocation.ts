import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Silently requests the device's current location once and returns it, or
 * undefined if permission is denied/unavailable. Directory screens use this
 * to request GPS-proximity sorting from the server - if it's undefined, the
 * server just falls back to its default ordering, so there's no error path
 * to handle here beyond "we didn't get coordinates."
 */
export function useUserLocation(): { lat: number; lng: number } | undefined {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        let granted = status === 'granted';
        if (!granted) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === 'granted';
        }
        if (!granted || cancelled) return;

        const loc = await Location.getLastKnownPositionAsync({});
        const position = loc ?? (await Location.getCurrentPositionAsync({}));
        if (!cancelled) setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      } catch {
        // Leave coords undefined - callers already treat that as "no proximity sort."
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return coords;
}
