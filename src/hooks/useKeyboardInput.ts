import { useRef, useCallback, useEffect } from 'react';

export interface KeyboardInputState {
  isSpacePressed: boolean;
  arrowDirection: { x: number; y: number };
  spaceJustReleased: boolean;
}

// パフォーマンス最適化: Refベースのキーボード入力管理
export function useKeyboardInput() {
  const stateRef = useRef<KeyboardInputState>({
    isSpacePressed: false,
    arrowDirection: { x: 0, y: -1 },
    spaceJustReleased: false,
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      stateRef.current.isSpacePressed = true;
      stateRef.current.spaceJustReleased = false;
    }

    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stateRef.current.arrowDirection.x = -1;
    }
    if (e.code === 'ArrowRight') {
      e.preventDefault();
      stateRef.current.arrowDirection.x = 1;
    }
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      stateRef.current.arrowDirection.y = -1;
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      stateRef.current.arrowDirection.y = 1;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      stateRef.current.isSpacePressed = false;
      stateRef.current.spaceJustReleased = true;
    }

    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      stateRef.current.arrowDirection.x = 0;
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      stateRef.current.arrowDirection.y = 0;
    }
  }, []);

  const clearSpaceReleased = useCallback(() => {
    stateRef.current.spaceJustReleased = false;
  }, []);

  // ゲッター関数（現在の状態を取得）
  const getState = useCallback(() => stateRef.current, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // 安定した参照を返す（stateRefを直接返す）
  return {
    stateRef,
    clearSpaceReleased,
    getState,
  };
}
