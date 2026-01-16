// ゲームの状態
export type GameScreen = 'title' | 'playing' | 'paused' | 'cleared' | 'gameover';

// 位置
export interface Position {
  x: number;
  y: number;
}

// 速度
export interface Velocity {
  x: number;
  y: number;
}

// タコの状態
export type TakoState = 'idle' | 'charging' | 'jumping' | 'dead';

// タコ
export interface Tako {
  position: Position;
  velocity: Velocity;
  state: TakoState;
  chargeStartTime: number | null;
  chargeRatio: number;
  isGrounded: boolean;
  facingRight: boolean;
  airChargeLockedVelocityX: number | null; // 空中チャージ開始時のx速度（慣性保持用）
  deadTime: number | null; // 死亡時刻（アニメーション用）
  hasAirJump: boolean; // 空中ジャンプが使用可能か
}

// 床のタイプ
export type PlatformType = 'normal' | 'ice' | 'caterpillar' | 'moving';

// 床
export interface Platform {
  x: number;
  y: number;
  width: number;
  type: PlatformType;
  blockCount: number; // ブロック数（整数）
  caterpillarOffset?: number; // キャタピラのアニメーションオフセット
  caterpillarDirection?: 1 | -1; // キャタピラの移動方向
  // 動く足場用
  movingDirection?: 1 | -1; // 移動方向（1: 右, -1: 左）
  movingSpeed?: number; // 移動速度
  initialX?: number; // 初期X座標（移動範囲の基準）
  movingRange?: number; // 移動範囲（左右の最大距離）
}

// 空中ジャンプクラゲ
export interface Jellyfish {
  x: number;
  y: number;
  size: number;
  isCollected: boolean;
  floatOffset: number; // 浮遊アニメーション用
}

// うなぎ（スーパージャンプアイテム）
export interface Eel {
  x: number;
  y: number;
  size: number;
  isCollected: boolean; // 取得済みかどうか
  rotation: number; // 回転アニメーション用
}

// 月（ゴール）
export interface Moon {
  x: number;
  y: number;
  size: number;
}

// 水
export interface Water {
  y: number;
  speed: number;
  isRising: boolean;
  waveOffset: number;
}

// 星（背景装飾）
export interface Star {
  x: number;
  y: number;
  size: number;
  type: 'dot' | 'cross' | 'crescent' | 'sparkle';
}

// カメラ
export interface Camera {
  y: number;
  targetY: number;
}

// ゲーム状態
export interface GameState {
  screen: GameScreen;
  stage: number;
  score: number;
  highScore: number;
  lives: number;
  stageStartTime: number;
  elapsedTime: number;
  tako: Tako;
  platforms: Platform[];
  eels: Eel[];
  jellyfish: Jellyfish[];
  moon: Moon;
  water: Water;
  camera: Camera;
  stars: Star[];
  isHighScoreUpdated: boolean;
}

// 入力状態
export interface InputState {
  isPressed: boolean;
  startPosition: Position | null;
  currentPosition: Position | null;
  touchId: number | null;
}
