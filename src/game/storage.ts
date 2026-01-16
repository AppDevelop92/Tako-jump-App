const HIGH_SCORE_KEY = 'tako-jump-high-score';

export function loadHighScore(): number {
  try {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, score.toString());
  } catch {
    // ストレージアクセス失敗時は何もしない
  }
}
