import { CONFIG } from './config';
import type { Tako, Platform, Moon, Water, Position, Eel, Jellyfish } from './types';

// 重力を適用
export function applyGravity(tako: Tako): Tako {
  if (tako.state === 'dead') return tako;

  const newVelocityY = Math.min(
    tako.velocity.y + CONFIG.TAKO.GRAVITY,
    CONFIG.TAKO.MAX_FALL_SPEED
  );

  return {
    ...tako,
    velocity: { ...tako.velocity, y: newVelocityY },
  };
}

// 位置を更新
export function updatePosition(tako: Tako): Tako {
  return {
    ...tako,
    position: {
      x: tako.position.x + tako.velocity.x,
      y: tako.position.y + tako.velocity.y,
    },
  };
}

// 床との衝突判定（高速落下時のすり抜け対策強化）
export function checkPlatformCollision(
  tako: Tako,
  platforms: Platform[],
  _cameraY: number
): { tako: Tako; landed: boolean; landedPlatform: Platform | null } {
  const takoBottom = tako.position.y + CONFIG.TAKO.HEIGHT;
  const takoLeft = tako.position.x;
  const takoRight = tako.position.x + CONFIG.TAKO.WIDTH;

  // 落下中のみ判定
  if (tako.velocity.y <= 0) {
    return { tako, landed: false, landedPlatform: null };
  }

  // 前フレームの位置を計算
  const prevBottom = takoBottom - tako.velocity.y;

  for (const platform of platforms) {
    const platTop = platform.y;
    const platBottom = platform.y + CONFIG.PLATFORM.HEIGHT;
    const platLeft = platform.x;
    const platRight = platform.x + platform.width;

    // 横方向の重なり（少し余裕を持たせる）
    const horizontalOverlap = takoRight > platLeft + 2 && takoLeft < platRight - 2;

    if (!horizontalOverlap) continue;

    // 上から着地判定（改良版）
    // 条件1: 前フレームで床の上にいた
    // 条件2: 現フレームで床を通過した、または床の上部に接触している
    const wasAbove = prevBottom <= platTop + 4; // 少し余裕を持たせる
    const nowAtOrBelow = takoBottom >= platTop;
    const notTooDeep = takoBottom < platBottom + tako.velocity.y; // 床を完全にすり抜けていない

    if (wasAbove && nowAtOrBelow && notTooDeep) {
      const isIce = platform.type === 'ice';
      const isCaterpillar = platform.type === 'caterpillar';

      // 氷の床: 着地時のx速度を維持して滑り開始（最大速度制限あり）
      // キャタピラ床: x速度は0にするが、キャタピラの移動で動く
      // 通常床: x速度は0
      let newVelocityX = 0;
      if (isIce) {
        // 着地時の水平速度をそのまま滑り速度に（摩擦0、入射角に比例、最大速度制限）
        const rawVelocityX = tako.velocity.x;
        const maxSlide = CONFIG.ICE.MAX_SLIDE_SPEED;
        newVelocityX = Math.max(-maxSlide, Math.min(maxSlide, rawVelocityX));
      } else if (isCaterpillar) {
        // キャタピラ床では速度0（キャタピラによる移動は別処理）
        newVelocityX = 0;
      }

      return {
        tako: {
          ...tako,
          position: { ...tako.position, y: platTop - CONFIG.TAKO.HEIGHT },
          velocity: { x: newVelocityX, y: 0 },
          state: 'idle',
          isGrounded: true,
          airChargeLockedVelocityX: null,
        },
        landed: true,
        landedPlatform: platform,
      };
    }
  }

  return { tako, landed: false, landedPlatform: null };
}

// 氷の床上での滑り処理（速度は一定を保つ - 摩擦なし）
export function applyIceFriction(tako: Tako, _platform: Platform | null): Tako {
  // 氷の床上では速度を変更しない（一度滑り出したら速度一定）
  // 着地時のx速度がそのまま維持される
  return tako;
}

// 足場から落ちたかどうかをチェック
export function checkFallenOffPlatform(tako: Tako, platform: Platform | null): Tako {
  if (!platform || !tako.isGrounded) {
    return tako;
  }

  const takoLeft = tako.position.x;
  const takoRight = tako.position.x + CONFIG.TAKO.WIDTH;
  const platLeft = platform.x;
  const platRight = platform.x + platform.width;

  // 足場の端から外れたら落下開始
  if (takoRight < platLeft || takoLeft > platRight) {
    return {
      ...tako,
      isGrounded: false,
      state: tako.state === 'charging' ? 'charging' : 'jumping',
    };
  }

  return tako;
}

// 横移動速度を制限
export function clampHorizontalVelocity(tako: Tako): Tako {
  const maxSpeed = CONFIG.TAKO.MAX_HORIZONTAL_SPEED;
  const clampedVx = Math.max(-maxSpeed, Math.min(maxSpeed, tako.velocity.x));

  if (clampedVx === tako.velocity.x) {
    return tako;
  }

  return {
    ...tako,
    velocity: { ...tako.velocity, x: clampedVx },
  };
}

// 画面端のループ（右端→左端、左端→右端）
export function wrapScreen(tako: Tako): Tako {
  let newX = tako.position.x;

  // 右端を超えたら左端から出てくる
  if (newX > CONFIG.CANVAS_WIDTH) {
    newX = -CONFIG.TAKO.WIDTH;
  }
  // 左端を超えたら右端から出てくる
  else if (newX < -CONFIG.TAKO.WIDTH) {
    newX = CONFIG.CANVAS_WIDTH;
  }

  // 速度はそのまま維持（角度を保持）
  return {
    ...tako,
    position: { ...tako.position, x: newX },
  };
}

// 月との衝突判定
export function checkMoonCollision(tako: Tako, moon: Moon): boolean {
  const takoCenterX = tako.position.x + CONFIG.TAKO.WIDTH / 2;
  const takoCenterY = tako.position.y + CONFIG.TAKO.HEIGHT / 2;
  const moonCenterX = moon.x + moon.size / 2;
  const moonCenterY = moon.y + moon.size / 2;

  const dx = takoCenterX - moonCenterX;
  const dy = takoCenterY - moonCenterY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance < (CONFIG.TAKO.WIDTH / 2 + moon.size / 2) * 0.7;
}

// 水との衝突判定
export function checkWaterCollision(tako: Tako, water: Water): boolean {
  const takoBottom = tako.position.y + CONFIG.TAKO.HEIGHT;
  return takoBottom > water.y;
}

// ジャンプ計算
export function calculateJump(
  chargeRatio: number,
  startPos: Position,
  endPos: Position
): { vx: number; vy: number; facingRight: boolean } {
  // 方向ベクトル
  const dx = endPos.x - startPos.x;
  const dy = endPos.y - startPos.y;

  // 角度を計算（上方向を基準）
  let angle = Math.atan2(-dy, dx);

  // 角度を制限（45度〜135度）
  if (angle < CONFIG.JUMP.MIN_ANGLE) {
    angle = CONFIG.JUMP.MIN_ANGLE;
  } else if (angle > CONFIG.JUMP.MAX_ANGLE) {
    angle = CONFIG.JUMP.MAX_ANGLE;
  }

  // ドラッグ距離が短い場合は真上にジャンプ
  const dragDistance = Math.sqrt(dx * dx + dy * dy);
  if (dragDistance < 20) {
    angle = Math.PI / 2; // 真上
  }

  // ジャンプ力
  const power = CONFIG.JUMP.MIN_VELOCITY +
    (CONFIG.JUMP.MAX_VELOCITY - CONFIG.JUMP.MIN_VELOCITY) * chargeRatio;

  return {
    vx: power * Math.cos(angle),
    vy: -power * Math.sin(angle),
    facingRight: dx >= 0,
  };
}

// キャタピラ床上でのタコ移動
export function applyCaterpillarMovement(tako: Tako, platform: Platform | null): Tako {
  if (!platform || platform.type !== 'caterpillar' || !tako.isGrounded) {
    return tako;
  }

  const direction = platform.caterpillarDirection || 1;
  const speed = CONFIG.CATERPILLAR.SPEED * direction;

  // タコを移動
  const newX = tako.position.x + speed;

  // 床から落ちそうな場合
  const takoLeft = newX;
  const takoRight = newX + CONFIG.TAKO.WIDTH;
  const platLeft = platform.x;
  const platRight = platform.x + platform.width;

  // 床の端を超えたら落下開始
  if (takoRight < platLeft || takoLeft > platRight) {
    return {
      ...tako,
      position: { ...tako.position, x: newX },
      isGrounded: false,
      state: 'jumping',
    };
  }

  return {
    ...tako,
    position: { ...tako.position, x: newX },
  };
}

// うなぎとの衝突判定
export function checkEelCollision(tako: Tako, eels: Eel[]): {
  tako: Tako;
  eels: Eel[];
  collected: boolean;
} {
  if (tako.state === 'dead') {
    return { tako, eels, collected: false };
  }

  const takoCenterX = tako.position.x + CONFIG.TAKO.WIDTH / 2;
  const takoCenterY = tako.position.y + CONFIG.TAKO.HEIGHT / 2;

  const newEels = eels.map(eel => {
    if (eel.isCollected) return eel;

    const eelCenterX = eel.x + eel.size / 2;
    const eelCenterY = eel.y + eel.size / 2;

    const dx = takoCenterX - eelCenterX;
    const dy = takoCenterY - eelCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 衝突判定
    if (distance < (CONFIG.TAKO.WIDTH / 2 + eel.size / 2) * 0.8) {
      return { ...eel, isCollected: true };
    }
    return eel;
  });

  // 新しく取得したうなぎがあるか確認
  const collectedEel = newEels.find((eel, i) => eel.isCollected && !eels[i].isCollected);

  if (collectedEel) {
    // スーパージャンプを発動（真上に飛ぶ）
    return {
      tako: {
        ...tako,
        velocity: { x: 0, y: -CONFIG.EEL.SUPER_JUMP_VELOCITY },
        state: 'jumping',
        isGrounded: false,
        chargeStartTime: null,
        chargeRatio: 0,
      },
      eels: newEels,
      collected: true,
    };
  }

  return { tako, eels: newEels, collected: false };
}

// 動く足場の更新
export function updateMovingPlatforms(platforms: Platform[]): Platform[] {
  return platforms.map(platform => {
    if (platform.type !== 'moving' || platform.initialX === undefined) {
      return platform;
    }

    const direction = platform.movingDirection || 1;
    const speed = platform.movingSpeed || CONFIG.MOVING.DEFAULT_SPEED;

    let newX = platform.x + speed * direction;
    let newDirection = direction;

    // 画面端で反転（画面幅全体を往復）
    const minX = 0;
    const maxX = CONFIG.CANVAS_WIDTH - platform.width;

    if (newX <= minX) {
      newX = minX;
      newDirection = 1;
    } else if (newX >= maxX) {
      newX = maxX;
      newDirection = -1;
    }

    return {
      ...platform,
      x: newX,
      movingDirection: newDirection as 1 | -1,
    };
  });
}

// 動く足場上でのタコ移動（足場と一緒に動く）
export function applyMovingPlatformMovement(tako: Tako, platform: Platform | null): Tako {
  if (!platform || platform.type !== 'moving' || !tako.isGrounded) {
    return tako;
  }

  const direction = platform.movingDirection || 1;
  const speed = platform.movingSpeed || CONFIG.MOVING.DEFAULT_SPEED;

  // タコを足場と一緒に移動
  const newX = tako.position.x + speed * direction;

  return {
    ...tako,
    position: { ...tako.position, x: newX },
  };
}

// クラゲとの衝突判定（空中ジャンプ付与）
export function checkJellyfishCollision(tako: Tako, jellyfish: Jellyfish[]): {
  tako: Tako;
  jellyfish: Jellyfish[];
  collected: boolean;
} {
  if (tako.state === 'dead') {
    return { tako, jellyfish, collected: false };
  }

  const takoCenterX = tako.position.x + CONFIG.TAKO.WIDTH / 2;
  const takoCenterY = tako.position.y + CONFIG.TAKO.HEIGHT / 2;

  const newJellyfish = jellyfish.map(jf => {
    if (jf.isCollected) return jf;

    const jfCenterX = jf.x + jf.size / 2;
    const jfCenterY = jf.y + jf.size / 2;

    const dx = takoCenterX - jfCenterX;
    const dy = takoCenterY - jfCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 衝突判定
    if (distance < (CONFIG.TAKO.WIDTH / 2 + jf.size / 2) * 0.8) {
      return { ...jf, isCollected: true };
    }
    return jf;
  });

  // 新しく取得したクラゲがあるか確認
  const collectedJf = newJellyfish.find((jf, i) => jf.isCollected && !jellyfish[i].isCollected);

  if (collectedJf) {
    // 空中ジャンプを付与
    return {
      tako: {
        ...tako,
        hasAirJump: true,
      },
      jellyfish: newJellyfish,
      collected: true,
    };
  }

  return { tako, jellyfish: newJellyfish, collected: false };
}
