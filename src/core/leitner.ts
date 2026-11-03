import { addDays } from './date';

/**
 * Lặp lại ngắt quãng kiểu Leitner, giữ đúng bản cũ:
 * - Nhớ rõ / đúng (2): lên 1 hộp (tối đa 5), đến hạn sau 1, 3, 7, 14, 30 ngày theo hộp mới.
 * - Mơ hồ (1): giữ hộp nhưng không quá hộp 2 (tối thiểu 1), ôn lại ngày mai.
 * - Quên / sai (0): về hộp 1, đến hạn ngay hôm nay, cộng 1 lần sai.
 * "Đã thuộc" = hộp ≥ 4.
 */
export type Grade = 0 | 1 | 2;

/** Khoảng giãn theo hộp (chỉ số = hộp). */
export const INTERVALS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = 5;
export const LEARNED_BOX = 4;

export interface LeitnerState {
  box: number;
  due: string;
  wrong: number;
  last: number;
}

export function applyGrade(prev: LeitnerState | undefined, g: Grade, today: string, now = Date.now()): LeitnerState {
  let box = prev?.box ?? 0;
  let wrong = prev?.wrong ?? 0;
  if (g === 2) box = Math.min(MAX_BOX, box + 1);
  else if (g === 1) box = Math.max(1, Math.min(box, 2));
  else {
    box = 1;
    wrong += 1;
  }
  const due = g === 0 ? today : addDays(today, g === 1 ? 1 : (INTERVALS[box] ?? 30));
  return { box, due, wrong, last: now };
}

/** 0 = chưa học, 1 = đang học, 2 = đã thuộc. */
export type Level = 0 | 1 | 2;
export const LEVEL_NAME = ['Chưa học', 'Đang học', 'Đã thuộc'] as const;

export function levelOf(s: LeitnerState | undefined): Level {
  if (!s || !s.box) return 0;
  return s.box >= LEARNED_BOX ? 2 : 1;
}

export function isDue(s: LeitnerState | undefined, today: string): boolean {
  return !!(s && s.box && s.due <= today);
}
