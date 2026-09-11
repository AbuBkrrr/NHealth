import { useEffect, useState } from 'react';

/** Returns milliseconds remaining until targetIso, ticking every second. Never goes below 0. */
export function useCountdown(targetIso: string | null): number {
  const [remaining, setRemaining] = useState(() => (targetIso ? new Date(targetIso).getTime() - Date.now() : 0));

  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return remaining;
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
