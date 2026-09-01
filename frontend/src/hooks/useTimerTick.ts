import { useEffect, useState } from 'react';

export function useTimerTick(isActive: boolean) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);
}
