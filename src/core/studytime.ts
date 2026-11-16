import { addDays } from './date';
import type { DayStat } from './db';

/**
 * Thời gian học thực tế theo ngày: đo khoảng giữa các lượt chấm trong phiên, bỏ khoảng nghỉ > 2 phút.
 * Tách ba nhóm: TR, tiếng Anh (thẻ từ, câu mẫu, shadowing), nói (câu nói có chấm, đề nói).
 */
export type StudyCat = 'tr' | 'en' | 'speak';
export const GAP_MS = 2 * 60 * 1000;
/** Màn không có lượt chấm (shadowing, đề nói mở riêng): tính theo thời gian mở màn, tối đa 30 phút/lần. */
export const SCREEN_CAP_SECS = 30 * 60;

const FIELD = { tr: 'st', en: 'se', speak: 'sk' } as const;

/** Số giây tính cho một lượt: 0 nếu chưa có mốc trước, hoặc khoảng cách > 2 phút (coi là nghỉ). */
export function lapSecs(prevAt: number | null, at: number): number {
  if (prevAt === null) return 0;
  const ms = at - prevAt;
  return ms > 0 && ms <= GAP_MS ? Math.round(ms / 1000) : 0;
}

/** Cộng dồn giây (và điểm nói nếu có) vào bản ghi ngày; trả về bản ghi mới. */
export function addStudy(d: DayStat, cat: StudyCat, secs: number, score?: number | null): DayStat {
  const f = FIELD[cat];
  const add = Math.max(0, Math.round(secs));
  // Không có giây nào thì không tạo trường (ngày cũ vẫn dùng `s` cho tới khi có số đo thật).
  const out: DayStat = add > 0 ? { ...d, [f]: (d[f] ?? 0) + add } : { ...d };
  if (typeof score === 'number' && Number.isFinite(score)) {
    out.ks = (d.ks ?? 0) + score;
    out.kn = (d.kn ?? 0) + 1;
  }
  return out;
}

export const hasSplit = (d: DayStat): boolean => d.st !== undefined || d.se !== undefined || d.sk !== undefined;

/**
 * Tổng giây học của một ngày. Ngày cũ (trước khi có tách TR / EN / nói) dùng `s`, số giây phiên đã ghi sẵn;
 * không ước lượng thêm từ số lượt ôn.
 */
export function studySecs(d: DayStat): number {
  return hasSplit(d) ? (d.st ?? 0) + (d.se ?? 0) + (d.sk ?? 0) : d.s || 0;
}

export const goalMet = (d: DayStat, goalMin: number): boolean => studySecs(d) >= goalMin * 60;

/** Thứ Hai của tuần chứa `day` (giờ máy). */
export function weekStart(day: string): string {
  const wd = new Date(`${day}T00:00:00`).getDay();
  return addDays(day, -((wd + 6) % 7));
}

export const weekDays = (start: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(start, i));

/** Thứ trong tuần của khóa ngày (0 = CN). */
export const weekdayOf = (day: string): number => new Date(`${day}T00:00:00`).getDay();
