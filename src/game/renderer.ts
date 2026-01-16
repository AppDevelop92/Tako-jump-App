import { CONFIG } from './config';
import type { GameState, Star, Platform, Eel, Jellyfish } from './types';

// 画像キャッシュ
const imageCache: Map<string, HTMLImageElement> = new Map();

// 足場画像のインポート
import platformNormalSrc from '../assets/platform_normal.png';
import platformIceSrc from '../assets/platform_ice.png';
import platformCaterpillarSrc from '../assets/platform_caterpillar.png';
import caterpillarBlockSrc from '../assets/caterpillar_block.png';
import caterpillarChainSrc from '../assets/caterpillar_chain.png';
import platformMovingSrc from '../assets/platform_moving.png';
import waterSrc from '../assets/water.png';
import jellyfishSrc from '../assets/jellyfish.png';

// 足場画像のキャッシュ
let platformImages: {
  normal: HTMLImageElement | null;
  ice: HTMLImageElement | null;
  caterpillar: HTMLImageElement | null;
  moving: HTMLImageElement | null;
} = {
  normal: null,
  ice: null,
  caterpillar: null,
  moving: null,
};

// キャタピラ用の画像キャッシュ
let caterpillarBlockImage: HTMLImageElement | null = null;
let caterpillarChainImage: HTMLImageElement | null = null;

// クラゲ画像のキャッシュ
let jellyfishImage: HTMLImageElement | null = null;

// 水画像のキャッシュ
let waterImage: HTMLImageElement | null = null;

// 足場画像の1ブロックあたりのサイズ（ソース画像内）
const PLATFORM_IMAGE_INFO: { [key: string]: { width: number; height: number; blockCount: number } } = {
  normal: { width: 505, height: 89, blockCount: 6 },
  ice: { width: 522, height: 89, blockCount: 6 },
  caterpillar: { width: 667, height: 128, blockCount: 6 },
  moving: { width: 505, height: 89, blockCount: 6 }, // normalと同じサイズ想定
};

// 足場画像をロード
export async function loadPlatformImages(): Promise<void> {
  const loadImg = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const [normal, ice, caterpillar, catBlock, catChain, moving, water, jellyfish] = await Promise.all([
    loadImg(platformNormalSrc),
    loadImg(platformIceSrc),
    loadImg(platformCaterpillarSrc),
    loadImg(caterpillarBlockSrc),
    loadImg(caterpillarChainSrc),
    loadImg(platformMovingSrc),
    loadImg(waterSrc),
    loadImg(jellyfishSrc),
  ]);

  platformImages = { normal, ice, caterpillar, moving };
  caterpillarBlockImage = catBlock;
  caterpillarChainImage = catChain;
  waterImage = water;
  jellyfishImage = jellyfish;
}

// 画像をロード
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (imageCache.has(src)) {
      resolve(imageCache.get(src)!);
      return;
    }

    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

// 背景を描画
export function drawBackground(ctx: CanvasRenderingContext2D, _cameraY: number) {
  ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
  ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
}

// 星を描画
export function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], cameraY: number) {
  stars.forEach(star => {
    const screenY = star.y - cameraY;

    // 画面外はスキップ
    if (screenY < -20 || screenY > CONFIG.CANVAS_HEIGHT + 20) return;

    ctx.fillStyle = star.type === 'sparkle' ? CONFIG.COLORS.STAR_BRIGHT : CONFIG.COLORS.STAR;

    switch (star.type) {
      case 'dot':
        ctx.fillRect(star.x, screenY, star.size, star.size);
        break;

      case 'cross':
        const halfSize = star.size / 2;
        ctx.fillRect(star.x - halfSize, screenY - 1, star.size, 2);
        ctx.fillRect(star.x - 1, screenY - halfSize, 2, star.size);
        break;

      case 'crescent':
        ctx.fillStyle = CONFIG.COLORS.CRESCENT;
        ctx.beginPath();
        ctx.arc(star.x, screenY, star.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.beginPath();
        ctx.arc(star.x + 3, screenY - 2, star.size / 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'sparkle':
        const s = star.size;
        ctx.beginPath();
        ctx.moveTo(star.x, screenY - s / 2);
        ctx.lineTo(star.x + s / 4, screenY);
        ctx.lineTo(star.x, screenY + s / 2);
        ctx.lineTo(star.x - s / 4, screenY);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(star.x - s / 2, screenY);
        ctx.lineTo(star.x, screenY + s / 4);
        ctx.lineTo(star.x + s / 2, screenY);
        ctx.lineTo(star.x, screenY - s / 4);
        ctx.closePath();
        ctx.fill();
        break;
    }
  });
}

// 床を描画
export function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[], cameraY: number) {
  const blockSize = CONFIG.PLATFORM.BLOCK_SIZE;

  platforms.forEach((platform, index) => {
    const screenY = platform.y - cameraY;

    // 地面（index 0）の場合は特別な描画
    if (index === 0) {
      // 画面外の場合はスキップ
      if (screenY > CONFIG.CANVAS_HEIGHT) return;

      // 地面は画面下まで続く紺色のブロック
      const groundHeight = CONFIG.CANVAS_HEIGHT - screenY;
      if (groundHeight <= 0) return;

      // 地面本体（紺色）
      ctx.fillStyle = CONFIG.COLORS.GROUND;
      ctx.fillRect(0, screenY, CONFIG.CANVAS_WIDTH, groundHeight);

      // ドット絵風のグリッドパターン
      ctx.fillStyle = CONFIG.COLORS.GROUND_LINE;
      for (let x = 0; x < CONFIG.CANVAS_WIDTH; x += blockSize) {
        ctx.fillRect(x, screenY, 1, groundHeight);
      }
      for (let y = screenY; y < CONFIG.CANVAS_HEIGHT; y += blockSize) {
        ctx.fillRect(0, y, CONFIG.CANVAS_WIDTH, 1);
      }

      return;
    }

    // 浮遊床の描画
    // 画面外はスキップ
    if (screenY < -CONFIG.PLATFORM.HEIGHT - 10 || screenY > CONFIG.CANVAS_HEIGHT) return;

    // 画像を使用して描画
    const platformType = platform.type || 'normal';
    const img = platformImages[platformType];
    const imgInfo = PLATFORM_IMAGE_INFO[platformType];

    // キャタピラ足場は特別な描画処理（ブロック + 回転するチェーン）
    if (platformType === 'caterpillar' && caterpillarBlockImage && caterpillarChainImage) {
      // チェーン画像の情報
      const chainTopHeight = 20;
      const chainBottomHeight = 20;

      // ブロック画像の情報
      const blockSrcWidth = caterpillarBlockImage.width / 7;
      const blockSrcHeight = caterpillarBlockImage.height;

      // 描画サイズ
      const destBlockWidth = blockSize;
      const scale = destBlockWidth / blockSrcWidth;
      const destBlockHeight = blockSrcHeight * scale;
      const destChainTopHeight = chainTopHeight * scale;
      const destChainBottomHeight = chainBottomHeight * scale;
      const yOffset = -destChainTopHeight;

      // チェーン回転アニメーション用オフセット
      const direction = platform.caterpillarDirection || 1;
      const chainAnimSpeed = 2; // チェーンの回転速度
      const animOffset = (Date.now() * chainAnimSpeed * 0.05 * direction) % caterpillarChainImage.width;

      // チェーン端の幅
      const chainEdgeWidth = 20;
      const destChainEdgeWidth = chainEdgeWidth * scale;

      // クリッピング領域を設定
      ctx.save();
      ctx.beginPath();
      ctx.rect(platform.x, screenY + yOffset, platform.width, destChainTopHeight + destBlockHeight + destChainBottomHeight);
      ctx.clip();

      // 上チェーン - スクロールアニメーション（左→右方向に動く）
      const chainMiddleSrcWidth = caterpillarChainImage.width - chainEdgeWidth * 2;
      const platformMiddleWidth = platform.width - destChainEdgeWidth * 2;

      // タイルを繰り返して描画（アニメーション用）
      const tileWidth = chainMiddleSrcWidth * scale;
      const startOffset = (animOffset * scale) % tileWidth;

      // 上チェーン中央部分をスクロール
      for (let xPos = -startOffset; xPos < platformMiddleWidth; xPos += tileWidth) {
        const drawX = platform.x + destChainEdgeWidth + xPos;
        const drawWidth = Math.min(tileWidth, platformMiddleWidth - xPos);
        if (drawX < platform.x + destChainEdgeWidth) continue;
        ctx.drawImage(
          caterpillarChainImage,
          chainEdgeWidth, 0, chainMiddleSrcWidth, chainTopHeight,
          drawX, screenY + yOffset, drawWidth, destChainTopHeight
        );
      }

      // 上チェーン端
      ctx.drawImage(
        caterpillarChainImage,
        0, 0, chainEdgeWidth, chainTopHeight,
        platform.x, screenY + yOffset, destChainEdgeWidth, destChainTopHeight
      );
      ctx.drawImage(
        caterpillarChainImage,
        caterpillarChainImage.width - chainEdgeWidth, 0, chainEdgeWidth, chainTopHeight,
        platform.x + platform.width - destChainEdgeWidth, screenY + yOffset, destChainEdgeWidth, destChainTopHeight
      );

      // ブロックの描画（中央）
      const blockY = screenY + yOffset + destChainTopHeight;
      for (let i = 0; i < platform.blockCount; i++) {
        const blockX = platform.x + i * destBlockWidth;
        const srcBlockIndex = i % 7;
        const srcX = srcBlockIndex * blockSrcWidth;
        ctx.drawImage(
          caterpillarBlockImage,
          srcX, 0, blockSrcWidth, blockSrcHeight,
          blockX, blockY, destBlockWidth, destBlockHeight
        );
      }

      // 下チェーン - 逆方向にスクロール
      const bottomChainY = screenY + yOffset + destChainTopHeight + destBlockHeight;
      const reverseOffset = (-animOffset * scale) % tileWidth;
      const startReverseOffset = reverseOffset < 0 ? reverseOffset + tileWidth : reverseOffset;

      for (let xPos = -startReverseOffset; xPos < platformMiddleWidth; xPos += tileWidth) {
        const drawX = platform.x + destChainEdgeWidth + xPos;
        const drawWidth = Math.min(tileWidth, platformMiddleWidth - xPos);
        if (drawX < platform.x + destChainEdgeWidth) continue;
        ctx.drawImage(
          caterpillarChainImage,
          chainEdgeWidth, caterpillarChainImage.height - chainBottomHeight, chainMiddleSrcWidth, chainBottomHeight,
          drawX, bottomChainY, drawWidth, destChainBottomHeight
        );
      }

      // 下チェーン端
      ctx.drawImage(
        caterpillarChainImage,
        0, caterpillarChainImage.height - chainBottomHeight, chainEdgeWidth, chainBottomHeight,
        platform.x, bottomChainY, destChainEdgeWidth, destChainBottomHeight
      );
      ctx.drawImage(
        caterpillarChainImage,
        caterpillarChainImage.width - chainEdgeWidth, caterpillarChainImage.height - chainBottomHeight, chainEdgeWidth, chainBottomHeight,
        platform.x + platform.width - destChainEdgeWidth, bottomChainY, destChainEdgeWidth, destChainBottomHeight
      );

      ctx.restore();

      // キャタピラの方向を示す矢印
      ctx.fillStyle = '#FFFFFF';
      const arrowX = platform.x + platform.width / 2;
      const arrowY = screenY + CONFIG.PLATFORM.HEIGHT / 2;
      if (direction > 0) {
        ctx.fillRect(arrowX + 2, arrowY, 6, 3);
        ctx.fillRect(arrowX + 6, arrowY - 2, 3, 2);
        ctx.fillRect(arrowX + 6, arrowY + 3, 3, 2);
      } else {
        ctx.fillRect(arrowX - 8, arrowY, 6, 3);
        ctx.fillRect(arrowX - 9, arrowY - 2, 3, 2);
        ctx.fillRect(arrowX - 9, arrowY + 3, 3, 2);
      }
    } else if (img && imgInfo) {
      // 通常の足場描画
      const srcBlockWidth = imgInfo.width / imgInfo.blockCount;
      const srcBlockHeight = imgInfo.height;
      const destBlockWidth = blockSize;
      const destBlockHeight = CONFIG.PLATFORM.HEIGHT;

      for (let i = 0; i < platform.blockCount; i++) {
        const blockX = platform.x + i * destBlockWidth;
        const srcBlockIndex = i % imgInfo.blockCount;
        const srcX = srcBlockIndex * srcBlockWidth;

        ctx.drawImage(
          img,
          srcX, 0, srcBlockWidth, srcBlockHeight,
          blockX, screenY, destBlockWidth, destBlockHeight
        );
      }

      // 動く足場の方向を示す矢印（水色）
      if (platformType === 'moving') {
        const direction = platform.movingDirection || 1;
        ctx.fillStyle = '#87CEEB'; // 水色
        const arrowX = platform.x + platform.width / 2;
        const arrowY = screenY + CONFIG.PLATFORM.HEIGHT / 2;
        if (direction > 0) {
          // 右矢印
          ctx.fillRect(arrowX + 2, arrowY, 6, 3);
          ctx.fillRect(arrowX + 6, arrowY - 2, 3, 2);
          ctx.fillRect(arrowX + 6, arrowY + 3, 3, 2);
        } else {
          // 左矢印
          ctx.fillRect(arrowX - 8, arrowY, 6, 3);
          ctx.fillRect(arrowX - 9, arrowY - 2, 3, 2);
          ctx.fillRect(arrowX - 9, arrowY + 3, 3, 2);
        }
      }
    } else {
      // フォールバック：画像がない場合は色で描画
      const isIce = platform.type === 'ice';
      const isCaterpillar = platform.type === 'caterpillar';
      let mainColor = CONFIG.COLORS.PLATFORM;
      let lightColor = CONFIG.COLORS.PLATFORM_LIGHT;

      if (isIce) {
        mainColor = CONFIG.ICE.COLOR;
        lightColor = CONFIG.ICE.COLOR_LIGHT;
      } else if (isCaterpillar) {
        mainColor = CONFIG.CATERPILLAR.COLOR_DARK;
        lightColor = CONFIG.CATERPILLAR.COLOR_LIGHT;
      }

      for (let i = 0; i < platform.blockCount; i++) {
        const blockX = platform.x + i * blockSize;
        ctx.fillStyle = mainColor;
        ctx.fillRect(blockX, screenY, blockSize, CONFIG.PLATFORM.HEIGHT);
        ctx.fillStyle = lightColor;
        ctx.fillRect(blockX, screenY, blockSize, 2);
        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(blockX + blockSize - 1, screenY, 1, CONFIG.PLATFORM.HEIGHT);
      }
    }
  });
}

// タコを描画
export function drawTako(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: { [key: string]: HTMLImageElement }
) {
  const { tako } = state;
  const screenY = tako.position.y - state.camera.y;

  // 画像を選択（1秒チャージに合わせて閾値調整）
  let imageName: string;
  if (tako.state === 'dead') {
    // 死亡アニメーション: 死亡後の経過時間に応じて3段階で変化
    // 0〜300ms: 死んだ瞬間（dead-0）
    // 300〜600ms: 死んだ直後（dead-1）
    // 600ms〜: 黒ずみ（dead-2）
    const deadElapsed = tako.deadTime ? performance.now() - tako.deadTime : 0;
    if (deadElapsed < 300) {
      imageName = 'dead-0';
    } else if (deadElapsed < 600) {
      imageName = 'dead-1';
    } else {
      imageName = 'dead-2';
    }
  } else if (tako.chargeRatio >= 1) {
    // 100%到達後: オレンジと黄色が高速で切り替わる（100msごと）
    const blinkPhase = Math.floor(performance.now() / 100) % 2;
    imageName = blinkPhase === 0 ? '100-orange' : '100-yellow';
  } else if (tako.chargeRatio >= 0.75) {
    imageName = '75';
  } else if (tako.chargeRatio >= 0.5) {
    imageName = '50';
  } else if (tako.chargeRatio >= 0.25) {
    imageName = '25';
  } else {
    imageName = '0';
  }

  const img = images[imageName];
  if (!img) return;

  ctx.save();

  // チャージ量に応じて縮むエフェクト（バネのように）
  // 最大30%縮む
  const shrinkRatio = 1 - tako.chargeRatio * 0.3;
  const drawHeight = CONFIG.TAKO.HEIGHT * shrinkRatio;
  // 縮んだ分だけ下にずらして床に接地したまま
  const yOffset = CONFIG.TAKO.HEIGHT - drawHeight;
  const adjustedScreenY = screenY + yOffset;

  // 向きを反転
  if (!tako.facingRight) {
    ctx.translate(tako.position.x + CONFIG.TAKO.WIDTH, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, adjustedScreenY, CONFIG.TAKO.WIDTH, drawHeight);
  } else {
    ctx.drawImage(img, tako.position.x, adjustedScreenY, CONFIG.TAKO.WIDTH, drawHeight);
  }

  ctx.restore();

  // 空中ジャンプを持っている時のキラキラエフェクト
  if (tako.hasAirJump && tako.state !== 'dead') {
    const time = Date.now();
    const sparkleColors = ['#FF69B4', '#FFD700', '#00FFFF', '#FFFFFF']; // ピンク、金、シアン、白

    // 複数のキラキラを周囲に配置
    for (let i = 0; i < 6; i++) {
      const angle = (time * 0.003 + (i * Math.PI * 2) / 6) % (Math.PI * 2);
      const radius = 18 + Math.sin(time * 0.005 + i) * 4;
      const sparkleX = tako.position.x + CONFIG.TAKO.WIDTH / 2 + Math.cos(angle) * radius;
      const sparkleY = screenY + CONFIG.TAKO.HEIGHT / 2 + Math.sin(angle) * radius * 0.6;

      const colorIndex = (Math.floor(time * 0.01) + i) % sparkleColors.length;
      const alpha = 0.5 + Math.sin(time * 0.01 + i * 2) * 0.3;

      ctx.fillStyle = sparkleColors[colorIndex];
      ctx.globalAlpha = alpha;

      // 星形のキラキラ
      const size = 3 + Math.sin(time * 0.008 + i) * 1.5;
      ctx.beginPath();
      ctx.moveTo(sparkleX, sparkleY - size);
      ctx.lineTo(sparkleX + size * 0.3, sparkleY);
      ctx.lineTo(sparkleX, sparkleY + size);
      ctx.lineTo(sparkleX - size * 0.3, sparkleY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sparkleX - size, sparkleY);
      ctx.lineTo(sparkleX, sparkleY + size * 0.3);
      ctx.lineTo(sparkleX + size, sparkleY);
      ctx.lineTo(sparkleX, sparkleY - size * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}

// 月を描画
export function drawMoon(ctx: CanvasRenderingContext2D, state: GameState) {
  const { moon } = state;
  const screenY = moon.y - state.camera.y;

  // 画面外はスキップ
  if (screenY < -moon.size || screenY > CONFIG.CANVAS_HEIGHT) return;

  ctx.fillStyle = CONFIG.COLORS.MOON;
  ctx.beginPath();
  ctx.arc(
    moon.x + moon.size / 2,
    screenY + moon.size / 2,
    moon.size / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // 三日月の影
  ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
  ctx.beginPath();
  ctx.arc(
    moon.x + moon.size / 2 + moon.size * 0.25,
    screenY + moon.size / 2 - moon.size * 0.1,
    moon.size / 2.5,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

// 水を描画（ドット絵風）
export function drawWater(ctx: CanvasRenderingContext2D, state: GameState) {
  const { water, camera } = state;
  const screenY = water.y - camera.y;

  // 画面外はスキップ
  if (screenY > CONFIG.CANVAS_HEIGHT) return;

  // 画像がロードされていない場合はフォールバック
  if (!waterImage) {
    ctx.fillStyle = CONFIG.COLORS.WATER;
    ctx.fillRect(0, screenY, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT - screenY);
    return;
  }

  // 画像を1.25倍に拡大して表示
  const scale = 1.25;
  // 整数に切り上げて隙間を防ぐ
  const imgWidth = Math.ceil(waterImage.width * scale);
  const imgHeight = Math.ceil(waterImage.height * scale);

  // 横スクロールオフセット（左方向にゆっくり移動、ループ）
  const scrollSpeed = 0.3;
  // スクロールオフセットを正の値で計算（負の値にならないように）
  const rawOffset = (water.waveOffset * scrollSpeed) % imgWidth;
  const scrollOffset = rawOffset < 0 ? rawOffset + imgWidth : rawOffset;

  // 画像をタイル状に並べて水面を描画
  const startY = Math.floor(screenY);

  // 開始X位置を計算（画面左端より左から開始してシームレスにループ）
  // スクロールオフセット分だけ左にずらす
  let startX = -scrollOffset;
  // startXが正の場合、1タイル分左にずらす
  while (startX > 0) {
    startX -= imgWidth;
  }

  // 横方向にタイル（隙間を防ぐため2px重ねて描画し、端をクリップ）
  const tileOverlap = 2;

  // 描画前に画面領域でクリップ（オーバーラップ分がはみ出さないように）
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, Math.max(0, startY), CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
  ctx.clip();

  for (let x = startX; x < CONFIG.CANVAS_WIDTH + tileOverlap; x += imgWidth - tileOverlap) {
    // 縦方向にタイル（水面から画面下端まで）
    for (let y = startY; y < CONFIG.CANVAS_HEIGHT + tileOverlap; y += imgHeight - tileOverlap) {
      // 整数座標で描画（小数点以下の誤差で隙間が生じるのを防ぐ）
      const drawX = Math.round(x);
      const drawY = Math.round(y);
      ctx.drawImage(
        waterImage,
        0, 0, waterImage.width, waterImage.height, // ソース領域（全体）
        drawX, drawY, imgWidth + 1, imgHeight + 1 // 描画領域（少し大きく描画）
      );
    }
  }

  ctx.restore();
}

// うなぎを描画（円形に曲がったうなぎ）
export function drawEels(ctx: CanvasRenderingContext2D, eels: Eel[], cameraY: number) {
  eels.forEach(eel => {
    if (eel.isCollected) return; // 取得済みはスキップ

    const screenY = eel.y - cameraY;

    // 画面外はスキップ
    if (screenY < -eel.size || screenY > CONFIG.CANVAS_HEIGHT + eel.size) return;

    const centerX = eel.x + eel.size / 2;
    const centerY = screenY + eel.size / 2;
    const radius = eel.size / 2 - 4;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(eel.rotation);

    // うなぎの体（円形に曲がった形）
    ctx.strokeStyle = CONFIG.EEL.COLOR;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 1.7);
    ctx.stroke();

    // うなぎの体のハイライト
    ctx.strokeStyle = CONFIG.EEL.COLOR_LIGHT;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0.2, Math.PI * 1.5);
    ctx.stroke();

    // うなぎの頭（開始点）
    const headAngle = 0;
    const headX = Math.cos(headAngle) * radius;
    const headY = Math.sin(headAngle) * radius;
    ctx.fillStyle = CONFIG.EEL.COLOR;
    ctx.beginPath();
    ctx.arc(headX, headY, 6, 0, Math.PI * 2);
    ctx.fill();

    // 目（白）
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(headX + 2, headY - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // 瞳
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(headX + 2.5, headY - 1.5, 1, 0, Math.PI * 2);
    ctx.fill();

    // 尻尾（終了点）
    const tailAngle = Math.PI * 1.7;
    const tailX = Math.cos(tailAngle) * radius;
    const tailY = Math.sin(tailAngle) * radius;
    ctx.fillStyle = CONFIG.EEL.COLOR;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tailX - 8, tailY + 4);
    ctx.lineTo(tailX - 8, tailY - 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // キラキラエフェクト（浮遊感）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const sparkleOffset = Math.sin(Date.now() * 0.01 + eel.x) * 3;
    ctx.fillRect(eel.x + 4, screenY + 4 + sparkleOffset, 2, 2);
    ctx.fillRect(eel.x + eel.size - 6, screenY + eel.size - 8 - sparkleOffset, 2, 2);
  });
}

// クラゲを描画（その場でキラキラするエフェクト）
export function drawJellyfish(ctx: CanvasRenderingContext2D, jellyfish: Jellyfish[], cameraY: number) {
  jellyfish.forEach(jf => {
    if (jf.isCollected) return; // 取得済みはスキップ

    // 上下動なし、その場に固定
    const screenY = jf.y - cameraY;

    // 画面外はスキップ
    if (screenY < -jf.size || screenY > CONFIG.CANVAS_HEIGHT + jf.size) return;

    const time = Date.now();

    // 画像があれば画像を描画
    if (jellyfishImage) {
      // わずかな透明度の揺らぎでキラキラ感を出す
      const alphaFlicker = 0.85 + Math.sin(time * 0.008 + jf.floatOffset) * 0.15;
      ctx.globalAlpha = alphaFlicker;
      ctx.drawImage(
        jellyfishImage,
        jf.x, screenY, jf.size, jf.size
      );
      ctx.globalAlpha = 1;
    } else {
      // フォールバック: 画像がない場合は図形で描画
      const centerX = jf.x + jf.size / 2;
      const centerY = screenY + jf.size / 2;

      ctx.fillStyle = '#FF69B4';
      ctx.beginPath();
      ctx.arc(centerX, centerY, jf.size / 2 - 4, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = '#FF69B4';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const tentacleX = centerX - 8 + i * 6;
        const waveOffset = Math.sin(time * 0.005 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(tentacleX, centerY);
        ctx.lineTo(tentacleX + waveOffset, centerY + 12);
        ctx.stroke();
      }
    }

    // 複数のキラキラエフェクト（ランダムな位置で点滅）
    const sparkleCount = 5;
    for (let i = 0; i < sparkleCount; i++) {
      // 各キラキラの点滅タイミングをずらす
      const sparklePhase = (time * 0.01 + jf.floatOffset + i * 1.3) % 2;
      const sparkleAlpha = sparklePhase < 1 ? sparklePhase : 2 - sparklePhase;

      if (sparkleAlpha > 0.3) {
        // キラキラの位置（クラゲの周囲に配置）
        const sparkleAngle = (i * Math.PI * 2 / sparkleCount) + jf.floatOffset;
        const sparkleRadius = jf.size * 0.4 + Math.sin(time * 0.003 + i) * 4;
        const sparkleX = jf.x + jf.size / 2 + Math.cos(sparkleAngle) * sparkleRadius;
        const sparkleY = screenY + jf.size / 2 + Math.sin(sparkleAngle) * sparkleRadius * 0.7;

        const sparkleColors = ['#FFFFFF', '#FFD700', '#FF69B4', '#00FFFF'];
        ctx.fillStyle = sparkleColors[i % sparkleColors.length];
        ctx.globalAlpha = sparkleAlpha * 0.8;

        // 星形のキラキラ
        const size = 2 + sparkleAlpha * 2;
        ctx.beginPath();
        ctx.moveTo(sparkleX, sparkleY - size);
        ctx.lineTo(sparkleX + size * 0.3, sparkleY);
        ctx.lineTo(sparkleX, sparkleY + size);
        ctx.lineTo(sparkleX - size * 0.3, sparkleY);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(sparkleX - size, sparkleY);
        ctx.lineTo(sparkleX, sparkleY + size * 0.3);
        ctx.lineTo(sparkleX + size, sparkleY);
        ctx.lineTo(sparkleX, sparkleY - size * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  });
}

// HUDを描画
export function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.textAlign = 'left';

  // ステージ（ポーズボタンの下に配置）
  ctx.fillText(`STAGE ${state.stage}`, 10, 70);

  // スコア
  ctx.textAlign = 'right';
  ctx.fillText(`${state.score}`, CONFIG.CANVAS_WIDTH - 10, 30);

  // ライフ（タコのミニアイコン）
  ctx.textAlign = 'left';
  for (let i = 0; i < CONFIG.LIVES; i++) {
    ctx.fillStyle = i < state.lives ? '#FFFFFF' : '#666666';
    ctx.fillRect(10 + i * 28, 85, 20, 24);
    ctx.fillStyle = i < state.lives ? '#000000' : '#444444';
    ctx.fillRect(13 + i * 28, 92, 5, 6);
    ctx.fillRect(22 + i * 28, 92, 5, 6);
  }

  // タイム
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'right';
  const minutes = Math.floor(state.elapsedTime / 60);
  const seconds = Math.floor(state.elapsedTime % 60);
  const ms = Math.floor((state.elapsedTime % 1) * 100);
  ctx.fillText(
    `${minutes}:${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`,
    CONFIG.CANVAS_WIDTH - 10,
    55
  );
}
