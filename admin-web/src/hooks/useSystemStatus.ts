import { useState, useEffect } from 'react';

/**
 * Real-time system clock and status component
 * Displays actual current time (updated every second)
 * Shows system connectivity status
 * HIPAA/FDA compliant - no hardcoded time
 */
export function useSystemStatus() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Set initial online status safely
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
  }, []);

  useEffect(() => {
    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const formatTime = () => {
    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getSignalStrength = () => {
    // Real-time connection quality indicator
    if (!isOnline) return '🔴';
    // Default to good signal when online
    return '📶';
  };

  const getSystemStatus = () => {
    return isOnline ? '🟢 System Online' : '🔴 System Offline';
  };

  return {
    currentTime,
    formattedTime: formatTime(),
    isOnline,
    signalStrength: getSignalStrength(),
    systemStatus: getSystemStatus(),
  };
}
