import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { MobileControls } from './MobileControls';
import {
  CONFIG,
  applyGravity,
  updatePosition,
  checkPlatformCollision,
  wrapScreen,
  checkMoonCollision,
  checkWaterCollision,
  generatePlatforms,
  generateMoon,
  generateStars,
  generateEels,
  generateJellyfish,
  setRandomSeed,
  initWater,
  calculateScore,
  drawBackground,
  drawStars,
  drawPlatforms,
  drawTako,
  drawMoon,
  drawWater,
  drawEels,
  drawJellyfish,
  drawHUD,
  loadHighScore,
  saveHighScore,
  applyIceFriction,
  applyCaterpillarMovement,
  applyMovingPlatformMovement,
  checkEelCollision,
  checkJellyfishCollision,
  updateMovingPlatforms,
  loadPlatformImages,
  checkFallenOffPlatform,
  clampHorizontalVelocity,
} from '../game';
import type { Platform, GameState } from '../game';
import { useGameLoop, useKeyboardInput } from '../hooks';

import tako0 from '../assets/tako-0.png';
import tako25 from '../assets/tako-25.png';
import tako50 from '../assets/tako-50.png';
import tako75 from '../assets/tako-75.png';
import tako100Orange from '../assets/tako-100-orange.png';
import tako100Yellow from '../assets/tako-100-yellow.png';
import takoDead0 from '../assets/tako-dead-0.png';
import takoDead1 from '../assets/tako-dead-1.png';
import takoDead2 from '../assets/tako-dead-2.png';

const createInitialState = (stage: number = 1, score: number = 0, lives: number = CONFIG.LIVES): GameState => {
  const stageConfig = CONFIG.STAGES[stage - 1];
  setRandomSeed(stage); // ステージ番号でシード固定
  const platforms = generatePlatforms(stageConfig);
  const moon = generateMoon(platforms);
  const eels = generateEels(stageConfig, platforms);
  const jellyfish = generateJellyfish(stageConfig, platforms);
  const totalHeight = stageConfig.totalHeight * CONFIG.CANVAS_HEIGHT;

  return {
    screen: 'title',
    stage,
    score,
    highScore: loadHighScore(),
    lives,
    stageStartTime: 0,
    elapsedTime: 0,
    tako: {
      position: { x: platforms[0].x + 50, y: platforms[0].y - CONFIG.TAKO.HEIGHT },
      velocity: { x: 0, y: 0 },
      state: 'idle',
      chargeStartTime: null,
      chargeRatio: 0,
      isGrounded: true,
      facingRight: true,
      airChargeLockedVelocityX: null,
      deadTime: null,
      hasAirJump: false,
    },
    platforms,
    eels,
    jellyfish,
    moon,
    water: initWater(stageConfig),
    camera: {
      y: platforms[0].y - CONFIG.CANVAS_HEIGHT + 200,
      targetY: platforms[0].y - CONFIG.CANVAS_HEIGHT + 200,
    },
    stars: generateStars(totalHeight),
    isHighScoreUpdated: false,
  };
};

// キーボード用のジャンプ計算（slidingVelocity: 氷の上で滑っている時の速度）
function calculateKeyboardJump(
  chargeRatio: number,
  direction: { x: number; y: number },
  slidingVelocity: number = 0
): { vx: number; vy: number; facingRight: boolean } {
  let angle = Math.PI / 2;

  if (direction.x !== 0) {
    if (direction.x < 0) {
      angle = Math.PI * 0.58;
    } else {
      angle = Math.PI * 0.42;
    }
  }

  const power = CONFIG.JUMP.MIN_VELOCITY +
    (CONFIG.JUMP.MAX_VELOCITY - CONFIG.JUMP.MIN_VELOCITY) * chargeRatio;

  // 横移動を0.7倍に + 滑り中の慣性を加算
  const baseVx = power * Math.cos(angle) * CONFIG.HORIZONTAL_FACTOR;
  const vx = baseVx + slidingVelocity;

  return {
    vx,
    vy: -power * Math.sin(angle),
    facingRight: slidingVelocity !== 0 ? slidingVelocity > 0 : direction.x >= 0,
  };
}

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GameState>(createInitialState);
  const [images, setImages] = useState<{ [key: string]: HTMLImageElement }>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // モバイル検出
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && window.innerWidth < 1024);
  }, []);

  // タッチ入力状態（モバイル用）
  const touchInputRef = useRef({
    direction: { x: 0, y: 0 },
    isJumpPressed: false,
    jumpJustReleased: false,
  });

  // パフォーマンス最適化: キーボード入力はRefベース
  const { stateRef: keyboardRef, clearSpaceReleased: _clearSpaceReleased } = useKeyboardInput();
  const jumpDirectionRef = useRef({ x: 0, y: -1 });
  const waterDelayTimerRef = useRef<number | null>(null);
  const currentPlatformRef = useRef<Platform | null>(null);

  // 画像をロード
  useEffect(() => {
    const loadImages = async () => {
      const imageMap: { [key: string]: string } = {
        '0': tako0,
        '25': tako25,
        '50': tako50,
        '75': tako75,
        '100-orange': tako100Orange,
        '100-yellow': tako100Yellow,
        'dead-0': takoDead0,
        'dead-1': takoDead1,
        'dead-2': takoDead2,
      };

      const loaded: { [key: string]: HTMLImageElement } = {};

      await Promise.all([
        // タコ画像をロード
        ...Object.entries(imageMap).map(([key, src]) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              loaded[key] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
          })
        ),
        // 足場画像をロード
        loadPlatformImages(),
      ]);

      setImages(loaded);
      setImagesLoaded(true);
    };

    loadImages();
  }, []);

  // タッチコントロールのハンドラー
  const handleDirectionChange = useCallback((direction: { x: number; y: number }) => {
    touchInputRef.current.direction = direction;
  }, []);

  const handleJumpStart = useCallback(() => {
    touchInputRef.current.isJumpPressed = true;
    touchInputRef.current.jumpJustReleased = false;
  }, []);

  const handleJumpEnd = useCallback(() => {
    touchInputRef.current.isJumpPressed = false;
    touchInputRef.current.jumpJustReleased = true;
  }, []);

  // ゲームを開始
  const startGame = useCallback(() => {
    const newState = createInitialState();
    newState.screen = 'playing';
    newState.stageStartTime = performance.now();

    const stageConfig = CONFIG.STAGES[0];
    waterDelayTimerRef.current = window.setTimeout(() => {
      setState(prev => ({
        ...prev,
        water: { ...prev.water, isRising: true },
      }));
    }, stageConfig.waterDelay);

    setState(newState);
  }, []);

  // 次のステージへ
  const nextStage = useCallback(() => {
    setState(prev => {
      const nextStageNum = prev.stage + 1;
      if (nextStageNum > CONFIG.STAGES.length) {
        // ステージ10クリア後はタイトルに戻る（ALL CLEAR処理はcleared画面で行う）
        return createInitialState(1, 0, CONFIG.LIVES);
      }

      const stageConfig = CONFIG.STAGES[nextStageNum - 1];
      setRandomSeed(nextStageNum); // ステージ番号でシード固定
      const platforms = generatePlatforms(stageConfig);
      const moon = generateMoon(platforms);
      const eels = generateEels(stageConfig, platforms);
      const jellyfish = generateJellyfish(stageConfig, platforms);
      const totalHeight = stageConfig.totalHeight * CONFIG.CANVAS_HEIGHT;

      if (waterDelayTimerRef.current) {
        clearTimeout(waterDelayTimerRef.current);
      }
      waterDelayTimerRef.current = window.setTimeout(() => {
        setState(p => ({
          ...p,
          water: { ...p.water, isRising: true },
        }));
      }, stageConfig.waterDelay);

      return {
        ...prev,
        screen: 'playing',
        stage: nextStageNum,
        stageStartTime: performance.now(),
        elapsedTime: 0,
        tako: {
          position: { x: platforms[0].x + 50, y: platforms[0].y - CONFIG.TAKO.HEIGHT },
          velocity: { x: 0, y: 0 },
          state: 'idle',
          chargeStartTime: null,
          chargeRatio: 0,
          isGrounded: true,
          facingRight: true,
          airChargeLockedVelocityX: null,
          deadTime: null,
          hasAirJump: false,
        },
        platforms,
        eels,
        jellyfish,
        moon,
        water: initWater(stageConfig),
        camera: {
          y: platforms[0].y - CONFIG.CANVAS_HEIGHT + 200,
          targetY: platforms[0].y - CONFIG.CANVAS_HEIGHT + 200,
        },
        stars: generateStars(totalHeight),
      };
    });
  }, []);

  // タイトルに戻る
  const returnToTitle = useCallback(() => {
    if (waterDelayTimerRef.current) {
      clearTimeout(waterDelayTimerRef.current);
    }
    setState(createInitialState());
  }, []);

  // ゲームループ（依存関係なし - 安定したコールバック）
  const updateGame = useCallback((deltaTime: number) => {
    // キーボード入力をRefから直接読み取る
    const keyboard = keyboardRef.current;
    const touchInput = touchInputRef.current;

    // 入力を統合（キーボード OR タッチ）
    const isJumpPressed = keyboard.isSpacePressed || touchInput.isJumpPressed;
    const jumpJustReleased = keyboard.spaceJustReleased || touchInput.jumpJustReleased;
    const arrowDirection = {
      x: keyboard.arrowDirection.x !== 0 ? keyboard.arrowDirection.x : touchInput.direction.x,
      y: keyboard.arrowDirection.y !== 0 ? keyboard.arrowDirection.y : touchInput.direction.y,
    };

    // タッチのjumpJustReleasedをリセット
    if (touchInput.jumpJustReleased) {
      touchInput.jumpJustReleased = false;
    }

    setState(prev => {
      if (prev.screen !== 'playing') return prev;

      let newState = { ...prev };
      let tako = { ...newState.tako };

      newState.elapsedTime = (performance.now() - newState.stageStartTime) / 1000;

      // 氷の上にいるかチェック
      const onIcePlatform = currentPlatformRef.current?.type === 'ice' && tako.isGrounded;

      // チャージ処理
      if (isJumpPressed && tako.state !== 'dead') {
        if (tako.chargeStartTime === null) {
          tako.chargeStartTime = performance.now();
          tako.state = 'charging';
          if (!tako.isGrounded) {
            tako.airChargeLockedVelocityX = tako.velocity.x;
          }
        }
        tako.chargeRatio = Math.min(
          (performance.now() - tako.chargeStartTime) / CONFIG.JUMP.MAX_CHARGE_TIME,
          1
        );
        // 氷の上では方向入力を無効化（滑りをコントロールできない）
        if (tako.isGrounded && !onIcePlatform && (arrowDirection.x !== 0 || arrowDirection.y !== 0)) {
          jumpDirectionRef.current = { x: arrowDirection.x, y: arrowDirection.y };
        }
        // 空中チャージ中は微小な横移動のみ許可
        if (!tako.isGrounded && arrowDirection.x !== 0) {
          tako.velocity.x += arrowDirection.x * CONFIG.TAKO.AIR_CONTROL_CHARGING * CONFIG.HORIZONTAL_FACTOR * deltaTime * 60;
        }
      }

      // ジャンプ発動
      const wasCharging = tako.chargeStartTime !== null;
      const isOnIce = currentPlatformRef.current?.type === 'ice';
      if (jumpJustReleased && wasCharging && tako.state !== 'dead') {
        // 空中での処理
        if (!tako.isGrounded) {
          // 空中ジャンプが使用可能な場合
          if (tako.hasAirJump) {
            const { vx, vy, facingRight } = calculateKeyboardJump(
              tako.chargeRatio,
              jumpDirectionRef.current,
              0
            );
            tako.velocity = { x: vx, y: vy };
            tako.state = 'jumping';
            tako.facingRight = facingRight;
            tako.hasAirJump = false; // 空中ジャンプを消費
          }
          // チャージ解除
          tako.chargeStartTime = null;
          tako.chargeRatio = 0;
          tako.airChargeLockedVelocityX = null;
        } else {
          // 地上にいる場合のみジャンプ発動
          // 氷の上で滑っている場合は慣性を適用
          const slidingVelocity = isOnIce ? tako.velocity.x : 0;
          const { vx, vy, facingRight } = calculateKeyboardJump(
            tako.chargeRatio,
            jumpDirectionRef.current,
            slidingVelocity
          );
          tako.velocity = { x: vx, y: vy };
          tako.state = 'jumping';
          tako.isGrounded = false;
          tako.facingRight = facingRight;
          tako.chargeStartTime = null;
          tako.chargeRatio = 0;
        }
        jumpDirectionRef.current = { x: 0, y: -1 };
        keyboard.spaceJustReleased = false;
      }

      // 空中微調整（横移動係数を適用）
      if (!tako.isGrounded && tako.state !== 'dead' && tako.airChargeLockedVelocityX === null) {
        if (arrowDirection.x !== 0) {
          tako.velocity.x += arrowDirection.x * CONFIG.TAKO.AIR_CONTROL * CONFIG.HORIZONTAL_FACTOR * deltaTime * 60;
        }
      }

      // 物理演算
      if (tako.state !== 'dead') {
        tako = applyGravity(tako);
        tako = updatePosition(tako);

        const collision = checkPlatformCollision(tako, newState.platforms, newState.camera.y);
        tako = collision.tako;

        if (collision.landed && collision.landedPlatform) {
          currentPlatformRef.current = collision.landedPlatform;
        }
        if (!tako.isGrounded) {
          currentPlatformRef.current = null;
        }

        tako = applyIceFriction(tako, currentPlatformRef.current);

        // 足場から落ちたかチェック（氷で滑り落ちた場合など）
        tako = checkFallenOffPlatform(tako, currentPlatformRef.current);

        // キャタピラ床上での移動
        tako = applyCaterpillarMovement(tako, currentPlatformRef.current);

        // 動く足場上での移動
        tako = applyMovingPlatformMovement(tako, currentPlatformRef.current);

        // 横移動速度を制限
        tako = clampHorizontalVelocity(tako);

        tako = wrapScreen(tako);

        // うなぎとの衝突判定
        const eelResult = checkEelCollision(tako, newState.eels);
        tako = eelResult.tako;
        newState.eels = eelResult.eels;

        // クラゲとの衝突判定（空中ジャンプ付与）
        const jellyfishResult = checkJellyfishCollision(tako, newState.jellyfish);
        tako = jellyfishResult.tako;
        newState.jellyfish = jellyfishResult.jellyfish;
      }

      newState.tako = tako;

      // うなぎの回転アニメーション
      newState.eels = newState.eels.map(eel => ({
        ...eel,
        rotation: eel.rotation + CONFIG.EEL.ROTATION_SPEED,
      }));

      // キャタピラのアニメーション
      newState.platforms = newState.platforms.map(platform => {
        if (platform.type === 'caterpillar') {
          return {
            ...platform,
            caterpillarOffset: ((platform.caterpillarOffset || 0) + 0.5) % (CONFIG.CATERPILLAR.SEGMENT_WIDTH * 2),
          };
        }
        return platform;
      });

      // 動く足場の更新
      newState.platforms = updateMovingPlatforms(newState.platforms);

      // 月との衝突（クリア）
      if (checkMoonCollision(tako, newState.moon) && tako.state !== 'dead') {
        const clearTime = newState.elapsedTime;
        const stageConfig = CONFIG.STAGES[newState.stage - 1];
        const stageScore = calculateScore(newState.stage, clearTime, stageConfig.baseTime);
        const newScore = newState.score + stageScore;

        let isHighScoreUpdated = false;
        if (newScore > newState.highScore) {
          saveHighScore(newScore);
          isHighScoreUpdated = true;
        }

        if (waterDelayTimerRef.current) {
          clearTimeout(waterDelayTimerRef.current);
        }

        return {
          ...newState,
          screen: 'cleared',
          score: newScore,
          highScore: Math.max(newScore, newState.highScore),
          isHighScoreUpdated,
        };
      }

      // 水との衝突
      if (checkWaterCollision(tako, newState.water) && tako.state !== 'dead') {
        tako.state = 'dead';
        tako.velocity = { x: 0, y: 0 };
        tako.deadTime = performance.now();
        newState.tako = tako;
        newState.lives--;

        if (newState.lives <= 0) {
          if (waterDelayTimerRef.current) {
            clearTimeout(waterDelayTimerRef.current);
          }

          let isHighScoreUpdated = false;
          if (newState.score > newState.highScore) {
            saveHighScore(newState.score);
            isHighScoreUpdated = true;
          }

          setTimeout(() => {
            setState(p => ({
              ...p,
              screen: 'gameover',
              highScore: Math.max(p.score, p.highScore),
              isHighScoreUpdated,
            }));
          }, 1000);
        } else {
          const stageConfig = CONFIG.STAGES[newState.stage - 1];

          if (waterDelayTimerRef.current) {
            clearTimeout(waterDelayTimerRef.current);
          }

          setTimeout(() => {
            setState(p => {
              const startPlatform = p.platforms[0];
              // うなぎをリセット（再度取得可能に）
              const resetEels = p.eels.map(eel => ({ ...eel, isCollected: false }));
              // クラゲをリセット（再度取得可能に）
              const resetJellyfish = p.jellyfish.map(jf => ({ ...jf, isCollected: false }));
              return {
                ...p,
                tako: {
                  position: { x: startPlatform.x + 50, y: startPlatform.y - CONFIG.TAKO.HEIGHT },
                  velocity: { x: 0, y: 0 },
                  state: 'idle',
                  chargeStartTime: null,
                  chargeRatio: 0,
                  isGrounded: true,
                  facingRight: true,
                  airChargeLockedVelocityX: null,
                  deadTime: null,
                  hasAirJump: false,
                },
                eels: resetEels,
                jellyfish: resetJellyfish,
                camera: {
                  y: startPlatform.y - CONFIG.CANVAS_HEIGHT + 200,
                  targetY: startPlatform.y - CONFIG.CANVAS_HEIGHT + 200,
                },
                water: initWater(stageConfig),
              };
            });

            waterDelayTimerRef.current = window.setTimeout(() => {
              setState(p => ({
                ...p,
                water: { ...p.water, isRising: true },
              }));
            }, stageConfig.waterDelay);
          }, 1000);
        }
      }

      // 水の上昇
      if (newState.water.isRising) {
        newState.water = {
          ...newState.water,
          y: newState.water.y - newState.water.speed,
          waveOffset: newState.water.waveOffset + CONFIG.WATER.WAVE_SPEED * 60,
        };
      }

      // カメラ追従
      const targetCameraY = tako.position.y - CONFIG.CANVAS_HEIGHT * 0.6;
      newState.camera = {
        ...newState.camera,
        targetY: targetCameraY,
        y: newState.camera.y + (targetCameraY - newState.camera.y) * 0.1,
      };

      return newState;
    });
  }, []); // 依存関係なし - keyboardRefは安定したref

  useGameLoop(updateGame, state.screen === 'playing');

  // ポーズ機能
  const pauseGame = useCallback(() => {
    if (state.screen === 'playing') {
      if (waterDelayTimerRef.current) {
        clearTimeout(waterDelayTimerRef.current);
      }
      setState(prev => ({ ...prev, screen: 'paused' }));
    }
  }, [state.screen]);

  const resumeGame = useCallback(() => {
    if (state.screen === 'paused') {
      const stageConfig = CONFIG.STAGES[state.stage - 1];
      // 水がまだ上昇中でなければタイマーを再開
      if (!state.water.isRising) {
        waterDelayTimerRef.current = window.setTimeout(() => {
          setState(prev => ({
            ...prev,
            water: { ...prev.water, isRising: true },
          }));
        }, stageConfig.waterDelay);
      }
      setState(prev => ({ ...prev, screen: 'playing' }));
    }
  }, [state.screen, state.stage, state.water.isRising]);

  const restartFromBeginning = useCallback(() => {
    if (waterDelayTimerRef.current) {
      clearTimeout(waterDelayTimerRef.current);
    }
    const newState = createInitialState();
    newState.screen = 'playing';
    newState.stageStartTime = performance.now();
    setState(newState);

    const stageConfig = CONFIG.STAGES[0];
    waterDelayTimerRef.current = window.setTimeout(() => {
      setState(prev => ({
        ...prev,
        water: { ...prev.water, isRising: true },
      }));
    }, stageConfig.waterDelay);
  }, []);

  // 描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagesLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBackground(ctx, state.camera.y);
    drawStars(ctx, state.stars, state.camera.y);
    drawMoon(ctx, state);
    drawPlatforms(ctx, state.platforms, state.camera.y);
    drawEels(ctx, state.eels, state.camera.y);
    drawJellyfish(ctx, state.jellyfish, state.camera.y);
    drawWater(ctx, state);
    drawTako(ctx, state, images);

    if (state.screen === 'playing' || state.screen === 'paused') {
      drawHUD(ctx, state);

      // ポーズボタン（左上、STAGEの上）
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(10, 10, 40, 40);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 40, 40);
      // ポーズアイコン（||）
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(18, 18, 8, 24);
      ctx.fillRect(34, 18, 8, 24);

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(isMobile ? 'BUTTON:CHARGE  ←→:DIR' : 'SPACE:CHARGE  ARROWS:DIR', 10, CONFIG.CANVAS_HEIGHT - 10);
    }

    // タイトル画面
    if (state.screen === 'title') {
      ctx.fillStyle = CONFIG.COLORS.UI_BG;
      ctx.fillRect(40, 250, CONFIG.CANVAS_WIDTH - 80, 350);
      ctx.strokeStyle = CONFIG.COLORS.UI_BORDER;
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 250, CONFIG.CANVAS_WIDTH - 80, 350);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '24px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TAKO', CONFIG.CANVAS_WIDTH / 2, 320);
      ctx.fillText('JUMP', CONFIG.CANVAS_WIDTH / 2, 360);

      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText('HIGH SCORE', CONFIG.CANVAS_WIDTH / 2, 420);
      ctx.fillText(`${state.highScore}`, CONFIG.CANVAS_WIDTH / 2, 450);

      ctx.fillText(isMobile ? 'TAP BUTTON' : 'PRESS SPACE', CONFIG.CANVAS_WIDTH / 2, 540);
    }

    // クリア画面
    if (state.screen === 'cleared') {
      const isAllClear = state.stage >= CONFIG.STAGES.length;

      ctx.fillStyle = CONFIG.COLORS.UI_BG;
      ctx.fillRect(40, 200, CONFIG.CANVAS_WIDTH - 80, 400);
      ctx.strokeStyle = CONFIG.COLORS.UI_BORDER;
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 200, CONFIG.CANVAS_WIDTH - 80, 400);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      // ALL CLEAR!! または STAGE CLEAR!
      if (isAllClear) {
        ctx.fillStyle = Math.floor(Date.now() / 200) % 2 === 0 ? '#FFD700' : '#FFFFFF';
        ctx.fillText('ALL CLEAR!!', CONFIG.CANVAS_WIDTH / 2, 260);
        ctx.fillStyle = '#FFFFFF';
      } else {
        ctx.fillText('STAGE CLEAR!', CONFIG.CANVAS_WIDTH / 2, 260);
      }

      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText('HIGH SCORE', CONFIG.CANVAS_WIDTH / 2, 320);
      ctx.fillText(`${state.highScore}`, CONFIG.CANVAS_WIDTH / 2, 350);

      ctx.fillText('SCORE', CONFIG.CANVAS_WIDTH / 2, 400);
      ctx.fillText(`${state.score}`, CONFIG.CANVAS_WIDTH / 2, 430);

      if (state.isHighScoreUpdated) {
        ctx.fillStyle = Math.floor(Date.now() / 200) % 2 === 0 ? '#FFD700' : '#FFFFFF';
        ctx.fillText('HIGH SCORE', CONFIG.CANVAS_WIDTH / 2, 480);
        ctx.fillText('UPDATED!!', CONFIG.CANVAS_WIDTH / 2, 510);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(isMobile ? 'TAP BUTTON' : 'PRESS SPACE', CONFIG.CANVAS_WIDTH / 2, 560);
    }

    // ゲームオーバー画面
    if (state.screen === 'gameover') {
      ctx.fillStyle = CONFIG.COLORS.UI_BG;
      ctx.fillRect(40, 200, CONFIG.CANVAS_WIDTH - 80, 400);
      ctx.strokeStyle = CONFIG.COLORS.UI_BORDER;
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 200, CONFIG.CANVAS_WIDTH - 80, 400);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', CONFIG.CANVAS_WIDTH / 2, 260);

      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText('HIGH SCORE', CONFIG.CANVAS_WIDTH / 2, 320);
      ctx.fillText(`${state.highScore}`, CONFIG.CANVAS_WIDTH / 2, 350);

      ctx.fillText('SCORE', CONFIG.CANVAS_WIDTH / 2, 400);
      ctx.fillText(`${state.score}`, CONFIG.CANVAS_WIDTH / 2, 430);

      if (state.isHighScoreUpdated) {
        ctx.fillStyle = Math.floor(Date.now() / 200) % 2 === 0 ? '#FFD700' : '#FFFFFF';
        ctx.fillText('HIGH SCORE', CONFIG.CANVAS_WIDTH / 2, 480);
        ctx.fillText('UPDATED!!', CONFIG.CANVAS_WIDTH / 2, 510);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(isMobile ? 'TAP BUTTON' : 'PRESS SPACE', CONFIG.CANVAS_WIDTH / 2, 560);
    }

    // ポーズ画面
    if (state.screen === 'paused') {
      // 半透明オーバーレイ
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      ctx.fillStyle = CONFIG.COLORS.UI_BG;
      ctx.fillRect(60, 280, CONFIG.CANVAS_WIDTH - 120, 280);
      ctx.strokeStyle = CONFIG.COLORS.UI_BORDER;
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 280, CONFIG.CANVAS_WIDTH - 120, 280);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', CONFIG.CANVAS_WIDTH / 2, 330);

      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText('CONTINUE', CONFIG.CANVAS_WIDTH / 2, 410);
      ctx.fillText('RESTART', CONFIG.CANVAS_WIDTH / 2, 480);

      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = '#AAAAAA';
      ctx.fillText('TAP TO SELECT', CONFIG.CANVAS_WIDTH / 2, 530);
    }
  }, [state, images, imagesLoaded]);

  // スペースキーでの画面遷移・ESCキーでポーズ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESCキーでポーズ/リジューム
      if (e.key === 'Escape') {
        if (state.screen === 'playing') {
          pauseGame();
        } else if (state.screen === 'paused') {
          resumeGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.screen, pauseGame, resumeGame]);

  useEffect(() => {
    if (state.screen === 'playing') return;

    const checkSpaceKey = () => {
      const keyboard = keyboardRef.current;
      const touchInput = touchInputRef.current;

      // キーボードまたはタッチでの入力を確認
      const released = keyboard.spaceJustReleased || touchInput.jumpJustReleased;

      if (released) {
        keyboard.spaceJustReleased = false;
        touchInput.jumpJustReleased = false;

        if (state.screen === 'title') {
          startGame();
        } else if (state.screen === 'cleared') {
          nextStage();
        } else if (state.screen === 'gameover') {
          returnToTitle();
        }
      }
    };

    const intervalId = setInterval(checkSpaceKey, 16);
    return () => clearInterval(intervalId);
  }, [state.screen, startGame, nextStage, returnToTitle]);

  // クリック/タッチハンドラー
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // プレイ中: ポーズボタンのクリック判定（左上）
    if (state.screen === 'playing') {
      if (x >= 10 && x <= 50 && y >= 10 && y <= 50) {
        pauseGame();
      }
    }

    // ポーズ中: メニュー選択
    if (state.screen === 'paused') {
      // CONTINUE (y: 390-430)
      if (x >= 60 && x <= CONFIG.CANVAS_WIDTH - 60 && y >= 390 && y <= 430) {
        resumeGame();
      }
      // RESTART (y: 460-500)
      if (x >= 60 && x <= CONFIG.CANVAS_WIDTH - 60 && y >= 460 && y <= 500) {
        restartFromBeginning();
      }
    }
  }, [state.screen, pauseGame, resumeGame, restartFromBeginning]);

  // モバイルの場合は縦画面レイアウト（コントロールは下部にオーバーレイ）
  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-[#2D2A5A] flex flex-col">
        {/* ゲーム画面（フルスクリーン） */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CONFIG.CANVAS_WIDTH}
            height={CONFIG.CANVAS_HEIGHT}
            className="max-w-full max-h-full"
            style={{
              imageRendering: 'pixelated',
            }}
            tabIndex={0}
            onClick={handleCanvasClick}
          />
        </div>

        {/* モバイルコントロール（下部にオーバーレイ） */}
        <MobileControls
          onDirectionChange={handleDirectionChange}
          onJumpStart={handleJumpStart}
          onJumpEnd={handleJumpEnd}
          isCharging={state.tako.chargeStartTime !== null}
        />
      </div>
    );
  }

  // PCの場合は通常レイアウト
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#2D2A5A]">
      <canvas
        ref={canvasRef}
        width={CONFIG.CANVAS_WIDTH}
        height={CONFIG.CANVAS_HEIGHT}
        className="max-w-full max-h-full"
        style={{ imageRendering: 'pixelated' }}
        tabIndex={0}
        onClick={handleCanvasClick}
      />
    </div>
  );
}
