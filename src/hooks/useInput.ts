import { useState, useCallback, useEffect } from 'react';
import type { InputState, Position } from '../game/types';

export function useInput(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [input, setInput] = useState<InputState>({
    isPressed: false,
    startPosition: null,
    currentPosition: null,
    touchId: null,
  });

  const getCanvasPosition = useCallback((clientX: number, clientY: number): Position => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [canvasRef]);

  const handleStart = useCallback((clientX: number, clientY: number, touchId?: number) => {
    const pos = getCanvasPosition(clientX, clientY);
    setInput({
      isPressed: true,
      startPosition: pos,
      currentPosition: pos,
      touchId: touchId ?? null,
    });
  }, [getCanvasPosition]);

  const handleMove = useCallback((clientX: number, clientY: number, touchId?: number) => {
    setInput(prev => {
      if (!prev.isPressed) return prev;
      if (touchId !== undefined && prev.touchId !== touchId) return prev;

      const pos = getCanvasPosition(clientX, clientY);
      return { ...prev, currentPosition: pos };
    });
  }, [getCanvasPosition]);

  const handleEnd = useCallback((touchId?: number) => {
    setInput(prev => {
      if (touchId !== undefined && prev.touchId !== touchId) return prev;

      return {
        isPressed: false,
        startPosition: null,
        currentPosition: null,
        touchId: null,
      };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      handleStart(touch.clientX, touch.clientY, touch.identifier);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      handleMove(touch.clientX, touch.clientY, touch.identifier);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      handleEnd(touch.identifier);
    };

    const onMouseDown = (e: MouseEvent) => {
      handleStart(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      handleEnd();
    };

    const onMouseLeave = () => {
      handleEnd();
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [canvasRef, handleStart, handleMove, handleEnd]);

  return input;
}
