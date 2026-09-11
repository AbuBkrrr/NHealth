import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** True when the device has no network connection (or NetInfo hasn't reported yet). */
export function useIsOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isConnected can be null before the first check resolves; treat that as online
      // so we don't flash a banner on every cold start.
      setIsOffline(state.isConnected === false);
    });
    return () => unsubscribe();
  }, []);

  return isOffline;
}
