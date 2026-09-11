import { useSystemStatus } from '../hooks/useSystemStatus';

/**
 * Compliance-ready Status Bar Component
 * Shows real system time (updated every second)
 * Shows real connectivity status
 * Used on all pages instead of hardcoded time
 */
export function StatusBar() {
  const { formattedTime, signalStrength, systemStatus } = useSystemStatus();

  return (
    <div className="status-bar">
      <span>{formattedTime}</span>
      <span title={systemStatus}>
        {signalStrength}
      </span>
    </div>
  );
}
