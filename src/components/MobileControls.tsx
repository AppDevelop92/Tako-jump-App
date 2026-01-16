import { useCallback, useState } from 'react';

interface MobileControlsProps {
  onDirectionChange: (direction: { x: number; y: number }) => void;
  onJumpStart: () => void;
  onJumpEnd: () => void;
  isCharging: boolean;
}

export function MobileControls({
  onDirectionChange,
  onJumpStart,
  onJumpEnd,
  isCharging,
}: MobileControlsProps) {
  const [leftTouchId, setLeftTouchId] = useState<number | null>(null);
  const [rightTouchId, setRightTouchId] = useState<number | null>(null);
  const [jumpTouchId, setJumpTouchId] = useState<number | null>(null);
  const [isJumpPressed, setIsJumpPressed] = useState(false);
  const [isLeftPressed, setIsLeftPressed] = useState(false);
  const [isRightPressed, setIsRightPressed] = useState(false);

  // 方向を更新
  const updateDirection = useCallback((left: boolean, right: boolean) => {
    let x = 0;
    if (left && !right) x = -1;
    else if (right && !left) x = 1;
    onDirectionChange({ x, y: x !== 0 ? -1 : 0 });
  }, [onDirectionChange]);

  // 左ボタンのタッチハンドラー
  const handleLeftTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    setLeftTouchId(touch.identifier);
    setIsLeftPressed(true);
    updateDirection(true, isRightPressed);
  }, [isRightPressed, updateDirection]);

  const handleLeftTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = Array.from(e.changedTouches).find(t => t.identifier === leftTouchId);
    if (touch) {
      setLeftTouchId(null);
      setIsLeftPressed(false);
      updateDirection(false, isRightPressed);
    }
  }, [leftTouchId, isRightPressed, updateDirection]);

  // 右ボタンのタッチハンドラー
  const handleRightTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    setRightTouchId(touch.identifier);
    setIsRightPressed(true);
    updateDirection(isLeftPressed, true);
  }, [isLeftPressed, updateDirection]);

  const handleRightTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = Array.from(e.changedTouches).find(t => t.identifier === rightTouchId);
    if (touch) {
      setRightTouchId(null);
      setIsRightPressed(false);
      updateDirection(isLeftPressed, false);
    }
  }, [rightTouchId, isLeftPressed, updateDirection]);

  // ジャンプボタンのタッチハンドラー
  const handleJumpTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    setJumpTouchId(touch.identifier);
    setIsJumpPressed(true);
    onJumpStart();
  }, [onJumpStart]);

  const handleJumpTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = Array.from(e.changedTouches).find(t => t.identifier === jumpTouchId);
    if (touch) {
      setJumpTouchId(null);
      setIsJumpPressed(false);
      onJumpEnd();
    }
  }, [jumpTouchId, onJumpEnd]);

  // ドット絵風ボタンのスタイル
  const pixelButtonStyle = (isPressed: boolean, isActive: boolean = false) => ({
    backgroundColor: isPressed ? '#E8A87C' : (isActive ? '#FFD93D' : '#3D3A6A'),
    border: '4px solid',
    borderColor: isPressed ? '#F0C8A8' : (isActive ? '#FFE066' : '#6B5B7A'),
    borderRadius: '8px', // 少しだけ角丸（ドット絵風）
    boxShadow: isPressed
      ? 'inset 2px 2px 0 rgba(0,0,0,0.3)'
      : '2px 2px 0 rgba(0,0,0,0.5), inset -2px -2px 0 rgba(0,0,0,0.2)',
    transform: isPressed ? 'translate(2px, 2px)' : 'translate(0, 0)',
    imageRendering: 'pixelated' as const,
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-between items-end px-6 pb-16 pointer-events-none z-50">
      {/* 左側: 方向ボタン（左・右） */}
      <div className="flex gap-4 pointer-events-auto">
        {/* 左ボタン */}
        <div
          className="relative touch-none select-none"
          style={{ width: '72px', height: '72px' }}
          onTouchStart={handleLeftTouchStart}
          onTouchEnd={handleLeftTouchEnd}
          onTouchCancel={handleLeftTouchEnd}
        >
          <div
            className="absolute inset-0 flex items-center justify-center transition-all duration-75"
            style={pixelButtonStyle(isLeftPressed)}
          >
            {/* ドット絵風の左矢印 */}
            <svg width="32" height="32" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
              <rect x="8" y="2" width="2" height="2" fill={isLeftPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="6" y="4" width="2" height="2" fill={isLeftPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="4" y="6" width="2" height="2" fill={isLeftPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="2" y="8" width="2" height="2" fill={isLeftPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="4" y="10" width="2" height="2" fill={isLeftPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="6" y="12" width="2" height="2" fill={isLeftPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="8" y="14" width="2" height="2" fill={isLeftPressed ? '#FFF' : '#9B8AC4'} />
              {/* 横線 */}
              <rect x="4" y="8" width="10" height="2" fill={isLeftPressed ? '#FFF' : '#9B8AC4'} />
            </svg>
          </div>
        </div>

        {/* 右ボタン */}
        <div
          className="relative touch-none select-none"
          style={{ width: '72px', height: '72px' }}
          onTouchStart={handleRightTouchStart}
          onTouchEnd={handleRightTouchEnd}
          onTouchCancel={handleRightTouchEnd}
        >
          <div
            className="absolute inset-0 flex items-center justify-center transition-all duration-75"
            style={pixelButtonStyle(isRightPressed)}
          >
            {/* ドット絵風の右矢印 */}
            <svg width="32" height="32" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
              <rect x="6" y="2" width="2" height="2" fill={isRightPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="8" y="4" width="2" height="2" fill={isRightPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="10" y="6" width="2" height="2" fill={isRightPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="12" y="8" width="2" height="2" fill={isRightPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="10" y="10" width="2" height="2" fill={isRightPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="8" y="12" width="2" height="2" fill={isRightPressed ? '#FFF' : '#9B8AC4'} />
              <rect x="6" y="14" width="2" height="2" fill={isRightPressed ? '#FFF' : '#9B8AC4'} />
              {/* 横線 */}
              <rect x="2" y="8" width="10" height="2" fill={isRightPressed ? '#FFF' : '#9B8AC4'} />
            </svg>
          </div>
        </div>
      </div>

      {/* 右側: ジャンプボタン */}
      <div
        className="relative touch-none select-none pointer-events-auto"
        style={{ width: '88px', height: '88px' }}
        onTouchStart={handleJumpTouchStart}
        onTouchEnd={handleJumpTouchEnd}
        onTouchCancel={handleJumpTouchEnd}
      >
        <div
          className="absolute inset-0 flex items-center justify-center transition-all duration-75"
          style={pixelButtonStyle(isJumpPressed, isCharging)}
        >
          {/* ドット絵風のジャンプアイコン（上矢印） */}
          <svg width="40" height="40" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
            <rect x="7" y="2" width="2" height="2" fill={isJumpPressed || isCharging ? '#FFF' : '#9B8AC4'} />
            <rect x="5" y="4" width="2" height="2" fill={isJumpPressed || isCharging ? '#FFF' : '#9B8AC4'} />
            <rect x="9" y="4" width="2" height="2" fill={isJumpPressed || isCharging ? '#FFF' : '#9B8AC4'} />
            <rect x="3" y="6" width="2" height="2" fill={isJumpPressed || isCharging ? '#FFF' : '#9B8AC4'} />
            <rect x="11" y="6" width="2" height="2" fill={isJumpPressed || isCharging ? '#FFF' : '#9B8AC4'} />
            {/* 縦線 */}
            <rect x="7" y="4" width="2" height="10" fill={isJumpPressed || isCharging ? '#FFF' : '#9B8AC4'} />
          </svg>
        </div>
      </div>
    </div>
  );
}
