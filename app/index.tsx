import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';
import { Canvas, useCanvasRef, Fill, Rect, Circle, Line, vec, Text as SkiaText, useFont, Group } from '@shopify/react-native-skia';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { CONFIG } from '../src/game/config';
import type { GameState, Platform, Tako } from '../src/game/types';
import {
  applyGravity,
  updatePosition,
  checkPlatformCollision,
  wrapScreen,
  checkMoonCollision,
  checkWaterCollision,
  applyIceFriction,
  applyCaterpillarMovement,
  applyMovingPlatformMovement,
  checkEelCollision,
  checkJellyfishCollision,
  updateMovingPlatforms,
  checkFallenOffPlatform,
  clampHorizontalVelocity,
} from '../src/game/physics';
import {
  generatePlatforms,
  generateMoon,
  generateStars,
  generateEels,
  generateJellyfish,
  setRandomSeed,
  initWater,
  calculateScore,
} from '../src/game/stage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCALE = Math.min(SCREEN_WIDTH / CONFIG.CANVAS_WIDTH, SCREEN_HEIGHT / CONFIG.CANVAS_HEIGHT);

const createInitialState = (stage: number = 1, score: number = 0, lives: number = CONFIG.LIVES): GameState => {
  const stageConfig = CONFIG.STAGES[stage - 1];
  setRandomSeed(stage);
  const platforms = generatePlatforms(stageConfig);
  const moon = generateMoon(platforms);
  const eels = generateEels(stageConfig, platforms);
  const jellyfish = generateJellyfish(stageConfig, platforms);
  const totalHeight = stageConfig.totalHeight * CONFIG.CANVAS_HEIGHT;

  return {
    screen: 'title',
    stage,
    score,
    highScore: 0,
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

function calculateJump(
  chargeRatio: number,
  direction: { x: number; y: number },
  slidingVelocity: number = 0
): { vx: number; vy: number; facingRight: boolean } {
  let angle = Math.PI / 2;
  if (direction.x !== 0) {
    angle = direction.x < 0 ? Math.PI * 0.58 : Math.PI * 0.42;
  }
  const power = CONFIG.JUMP.MIN_VELOCITY + (CONFIG.JUMP.MAX_VELOCITY - CONFIG.JUMP.MIN_VELOCITY) * chargeRatio;
  const baseVx = power * Math.cos(angle) * CONFIG.HORIZONTAL_FACTOR;
  const vx = baseVx + slidingVelocity;
  return {
    vx,
    vy: -power * Math.sin(angle),
    facingRight: slidingVelocity !== 0 ? slidingVelocity > 0 : direction.x >= 0,
  };
}

export default function GameScreen() {
  const [state, setState] = useState<GameState>(createInitialState);
  const [isJumpPressed, setIsJumpPressed] = useState(false);
  const directionRef = useRef({ x: 0, y: 0 });
  const jumpDirectionRef = useRef({ x: 0, y: -1 });
  const currentPlatformRef = useRef<Platform | null>(null);
  const lastTimeRef = useRef(Date.now());

  // ゲームループ
  useEffect(() => {
    if (state.screen !== 'playing') return;

    const gameLoop = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setState(prev => {
        if (prev.screen !== 'playing') return prev;

        let newState = { ...prev };
        let tako = { ...newState.tako };

        newState.elapsedTime = (Date.now() - newState.stageStartTime) / 1000;

        // チャージ処理
        if (isJumpPressed && tako.state !== 'dead') {
          if (tako.chargeStartTime === null) {
            tako.chargeStartTime = Date.now();
            tako.state = 'charging';
          }
          tako.chargeRatio = Math.min((Date.now() - tako.chargeStartTime) / CONFIG.JUMP.MAX_CHARGE_TIME, 1);
          if (tako.isGrounded && (directionRef.current.x !== 0)) {
            jumpDirectionRef.current = { x: directionRef.current.x, y: -1 };
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
          tako = checkFallenOffPlatform(tako, currentPlatformRef.current);
          tako = applyCaterpillarMovement(tako, currentPlatformRef.current);
          tako = applyMovingPlatformMovement(tako, currentPlatformRef.current);
          tako = clampHorizontalVelocity(tako);
          tako = wrapScreen(tako);

          const eelResult = checkEelCollision(tako, newState.eels);
          tako = eelResult.tako;
          newState.eels = eelResult.eels;

          const jellyfishResult = checkJellyfishCollision(tako, newState.jellyfish);
          tako = jellyfishResult.tako;
          newState.jellyfish = jellyfishResult.jellyfish;
        }

        newState.tako = tako;

        // 水の上昇
        if (newState.water.isRising) {
          newState.water = {
            ...newState.water,
            y: newState.water.y - newState.water.speed,
            waveOffset: newState.water.waveOffset + CONFIG.WATER.WAVE_SPEED * 60,
          };
        }

        // 月との衝突（クリア）
        if (checkMoonCollision(tako, newState.moon) && tako.state !== 'dead') {
          return { ...newState, screen: 'cleared' };
        }

        // 水との衝突
        if (checkWaterCollision(tako, newState.water) && tako.state !== 'dead') {
          tako.state = 'dead';
          tako.velocity = { x: 0, y: 0 };
          newState.tako = tako;
          newState.lives--;
          if (newState.lives <= 0) {
            setTimeout(() => setState(p => ({ ...p, screen: 'gameover' })), 1000);
          } else {
            setTimeout(() => {
              setState(p => {
                const startPlatform = p.platforms[0];
                return {
                  ...p,
                  tako: {
                    ...createInitialState().tako,
                    position: { x: startPlatform.x + 50, y: startPlatform.y - CONFIG.TAKO.HEIGHT },
                  },
                  water: initWater(CONFIG.STAGES[p.stage - 1]),
                };
              });
            }, 1000);
          }
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
    }, 1000 / 60);

    return () => clearInterval(gameLoop);
  }, [state.screen, isJumpPressed]);

  // ジャンプ処理
  const handleJumpEnd = useCallback(() => {
    setIsJumpPressed(false);
    setState(prev => {
      if (prev.screen !== 'playing' || prev.tako.state === 'dead') return prev;
      if (prev.tako.chargeStartTime === null) return prev;

      const tako = prev.tako;
      const isOnIce = currentPlatformRef.current?.type === 'ice';
      const slidingVelocity = isOnIce ? tako.velocity.x : 0;
      const { vx, vy, facingRight } = calculateJump(tako.chargeRatio, jumpDirectionRef.current, slidingVelocity);

      return {
        ...prev,
        tako: {
          ...tako,
          velocity: { x: vx, y: vy },
          state: 'jumping',
          isGrounded: false,
          facingRight,
          chargeStartTime: null,
          chargeRatio: 0,
        },
      };
    });
  }, []);

  const startGame = useCallback(() => {
    const newState = createInitialState();
    newState.screen = 'playing';
    newState.stageStartTime = Date.now();
    lastTimeRef.current = Date.now();
    setTimeout(() => {
      setState(prev => ({ ...prev, water: { ...prev.water, isRising: true } }));
    }, CONFIG.STAGES[0].waterDelay);
    setState(newState);
  }, []);

  const nextStage = useCallback(() => {
    setState(prev => {
      const nextStageNum = prev.stage + 1;
      if (nextStageNum > CONFIG.STAGES.length) {
        return createInitialState();
      }
      const stageConfig = CONFIG.STAGES[nextStageNum - 1];
      setRandomSeed(nextStageNum);
      const platforms = generatePlatforms(stageConfig);
      const moon = generateMoon(platforms);
      const newState = {
        ...prev,
        screen: 'playing' as const,
        stage: nextStageNum,
        stageStartTime: Date.now(),
        tako: {
          ...createInitialState().tako,
          position: { x: platforms[0].x + 50, y: platforms[0].y - CONFIG.TAKO.HEIGHT },
        },
        platforms,
        moon,
        water: initWater(stageConfig),
        camera: {
          y: platforms[0].y - CONFIG.CANVAS_HEIGHT + 200,
          targetY: platforms[0].y - CONFIG.CANVAS_HEIGHT + 200,
        },
      };
      setTimeout(() => {
        setState(p => ({ ...p, water: { ...p.water, isRising: true } }));
      }, stageConfig.waterDelay);
      return newState;
    });
  }, []);

  const cameraY = state.camera.y;

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.gameContainer}>
        <Canvas style={styles.canvas}>
          {/* 背景 */}
          <Fill color={CONFIG.COLORS.BACKGROUND} />

          {/* 星 */}
          {state.stars.map((star, i) => (
            <Circle
              key={i}
              cx={star.x * SCALE}
              cy={(star.y - cameraY) * SCALE}
              r={star.size * SCALE}
              color={CONFIG.COLORS.STAR}
              opacity={star.opacity}
            />
          ))}

          {/* 足場 */}
          {state.platforms.map((platform, i) => (
            <Rect
              key={i}
              x={platform.x * SCALE}
              y={(platform.y - cameraY) * SCALE}
              width={platform.width * SCALE}
              height={platform.height * SCALE}
              color={platform.type === 'ice' ? '#87CEEB' : CONFIG.COLORS.PLATFORM}
            />
          ))}

          {/* 月 */}
          <Circle
            cx={(state.moon.x + state.moon.radius) * SCALE}
            cy={(state.moon.y + state.moon.radius - cameraY) * SCALE}
            r={state.moon.radius * SCALE}
            color={CONFIG.COLORS.MOON}
          />

          {/* うなぎ */}
          {state.eels.filter(e => !e.isCollected).map((eel, i) => (
            <Rect
              key={i}
              x={eel.x * SCALE}
              y={(eel.y - cameraY) * SCALE}
              width={CONFIG.EEL.WIDTH * SCALE}
              height={CONFIG.EEL.HEIGHT * SCALE}
              color="#FFD700"
            />
          ))}

          {/* クラゲ */}
          {state.jellyfish.filter(j => !j.isCollected).map((jf, i) => (
            <Circle
              key={i}
              cx={(jf.x + 15) * SCALE}
              cy={(jf.y + 15 - cameraY) * SCALE}
              r={15 * SCALE}
              color="#FF69B4"
            />
          ))}

          {/* タコ */}
          <Group>
            <Rect
              x={state.tako.position.x * SCALE}
              y={(state.tako.position.y - cameraY) * SCALE}
              width={CONFIG.TAKO.WIDTH * SCALE}
              height={CONFIG.TAKO.HEIGHT * SCALE}
              color={state.tako.state === 'charging' ? '#FF6B6B' : '#E8A87C'}
            />
          </Group>

          {/* 水 */}
          <Rect
            x={0}
            y={(state.water.y - cameraY) * SCALE}
            width={CONFIG.CANVAS_WIDTH * SCALE}
            height={(CONFIG.CANVAS_HEIGHT * 10) * SCALE}
            color={CONFIG.COLORS.WATER}
            opacity={0.8}
          />
        </Canvas>

        {/* タイトル画面オーバーレイ */}
        {state.screen === 'title' && (
          <View style={styles.overlay}>
            <Text style={styles.title}>TAKO JUMP</Text>
            <TouchableOpacity style={styles.button} onPress={startGame}>
              <Text style={styles.buttonText}>START</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* クリア画面オーバーレイ */}
        {state.screen === 'cleared' && (
          <View style={styles.overlay}>
            <Text style={styles.title}>STAGE CLEAR!</Text>
            <TouchableOpacity style={styles.button} onPress={nextStage}>
              <Text style={styles.buttonText}>NEXT STAGE</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ゲームオーバー画面オーバーレイ */}
        {state.screen === 'gameover' && (
          <View style={styles.overlay}>
            <Text style={styles.title}>GAME OVER</Text>
            <TouchableOpacity style={styles.button} onPress={() => setState(createInitialState())}>
              <Text style={styles.buttonText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* HUD */}
        {state.screen === 'playing' && (
          <View style={styles.hud}>
            <Text style={styles.hudText}>STAGE {state.stage}</Text>
            <Text style={styles.hudText}>LIVES: {state.lives}</Text>
          </View>
        )}
      </View>

      {/* コントロール */}
      {state.screen === 'playing' && (
        <View style={styles.controls}>
          <View style={styles.directionControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPressIn={() => { directionRef.current = { x: -1, y: -1 }; }}
              onPressOut={() => { directionRef.current = { x: 0, y: 0 }; }}
            >
              <Text style={styles.controlText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPressIn={() => { directionRef.current = { x: 1, y: -1 }; }}
              onPressOut={() => { directionRef.current = { x: 0, y: 0 }; }}
            >
              <Text style={styles.controlText}>→</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.jumpButton, isJumpPressed && styles.jumpButtonPressed]}
            onPressIn={() => setIsJumpPressed(true)}
            onPressOut={handleJumpEnd}
          >
            <Text style={styles.controlText}>JUMP</Text>
          </TouchableOpacity>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.BACKGROUND,
  },
  gameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: CONFIG.CANVAS_WIDTH * SCALE,
    height: CONFIG.CANVAS_HEIGHT * SCALE,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD93D',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#E8A87C',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D2A5A',
  },
  hud: {
    position: 'absolute',
    top: 50,
    left: 20,
  },
  hudText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  directionControls: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    width: 70,
    height: 70,
    backgroundColor: '#3D3A6A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#6B5B7A',
  },
  jumpButton: {
    width: 90,
    height: 90,
    backgroundColor: '#3D3A6A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#6B5B7A',
  },
  jumpButtonPressed: {
    backgroundColor: '#FFD93D',
  },
  controlText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
