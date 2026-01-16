import { useRef, useCallback, useEffect } from 'react';

export function useGameLoop(callback: (deltaTime: number) => void, isRunning: boolean) {
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== null) {
      const deltaTime = Math.min((time - previousTimeRef.current) / 1000, 0.1);
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    if (isRunning) {
      previousTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, animate]);
}
