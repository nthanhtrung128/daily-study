import { addDays } from '../../core/date';
import type { DayStat } from '../../core/db';
import { goalMet, hasSplit, studySecs, weekDays, weekdayOf } from '../../core/studytime';

/** Tổng kết một tuần (thứ Hai → Chủ nhật, giờ máy), tính thuần từ thống kê ngày. */
export interface WeekDay {
  day: string;
  secs: number;
  n: number;
  met: boolean;
}

export interface WeekSummary {
  start: string;
  days: WeekDay[];
  /** Tổng giây học; `tr + en + speak` có thể nhỏ hơn nếu tuần có ngày cũ chưa tách nhóm. */
  secs: number;
  tr: number;
  en: number;
  speak: number;
  /** Số ngày có ít nhất 1 lượt ôn hoặc có thời gian học. */
  activeDays: number;
  goalDays: number;
  mastered: number;
  n: number;
  ok: number;
  /** Tỉ lệ nhớ rõ / đúng (0–1), null khi chưa có lượt ôn. */
  recall: number | null;
  /** Điểm nói trung bình (%), null khi chưa có lần chấm. */
  speakAvg: number | null;
  empty: boolean;
}

export function weekSummary(dayStat: (day: string) => DayStat, start: string, goalMin: number): WeekSummary {
  const w: WeekSummary = { start, days: [], secs: 0, tr: 0, en: 0, speak: 0, activeDays: 0, goalDays: 0, mastered: 0, n: 0, ok: 0, recall: null, speakAvg: null, empty: true };
  let ks = 0;
  let kn = 0;
  for (const day of weekDays(start)) {
    const d = dayStat(day);
    const secs = studySecs(d);
    const met = goalMet(d, goalMin);
    w.days.push({ day, secs, n: d.n, met });
    w.secs += secs;
    if (hasSplit(d)) {
      w.tr += d.st ?? 0;
      w.en += d.se ?? 0;
      w.speak += d.sk ?? 0;
    }
    if (d.n > 0 || secs > 0) w.activeDays++;
    if (met) w.goalDays++;
    w.mastered += d.m ?? 0;
    w.n += d.n;
    w.ok += d.ok;
    ks += d.ks ?? 0;
    kn += d.kn ?? 0;
  }
  w.recall = w.n ? w.ok / w.n : null;
  w.speakAvg = kn ? ks / kn : null;
  w.empty = w.activeDays === 0;
  return w;
}

/** Làm tròn phút để hiển thị (dưới 1 phút nhưng có học thì tính 1). */
export const mins = (secs: number): number => (secs > 0 ? Math.max(1, Math.round(secs / 60)) : 0);

export interface Delta {
  dir: 'up' | 'down' | 'same';
  /** Chênh lệch tuyệt đối (đã làm tròn theo đơn vị hiển thị). */
  by: number;
}

/** So với tuần trước; null khi một trong hai bên không có số. */
export function delta(cur: number | null, prev: number | null): Delta | null {
  if (cur === null || prev === null) return null;
  const by = Math.round(cur - prev);
  return { dir: by > 0 ? 'up' : by < 0 ? 'down' : 'same', by: Math.abs(by) };
}

export const prevWeek = (start: string): string => addDays(start, -7);
export const nextWeek = (start: string): string => addDays(start, 7);

const DAY_VI = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'] as const;
export const dayLongVi = (day: string): string => DAY_VI[weekdayOf(day)] ?? '';

/** "03/11 – 09/11". */
export function weekLabel(start: string): string {
  const f = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return `${f(start)} – ${f(addDays(start, 6))}`;
}
