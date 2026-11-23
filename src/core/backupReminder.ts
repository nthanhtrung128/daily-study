/**
 * Nhắc sao lưu định kỳ (chỉ trong app, không gửi thông báo ra ngoài).
 * Lưu trong bảng `settings`:
 * - `backup.lastAt`: thời điểm (ms) xuất sao lưu gần nhất trên máy này;
 * - `backup.snoozeUntil`: "Để sau" → ẩn nhắc tới thời điểm này (ms);
 * - `backup.remindDays`: chu kỳ nhắc 7 / 14 / 30 ngày, 0 = tắt.
 * Hai khóa đầu là của riêng máy → không đưa vào file sao lưu, không ghi đè khi nhập.
 */
import { caseDraftKeys } from './caseDraft';

export const LAST_KEY = 'backup.lastAt';
export const SNOOZE_KEY = 'backup.snoozeUntil';
export const EVERY_KEY = 'backup.remindDays';
export const LOCAL_ONLY_KEYS: ReadonlySet<string> = new Set([LAST_KEY, SNOOZE_KEY, 'tr.capstone.draft', ...Object.values(caseDraftKeys)]);

export const REMIND_CHOICES = [7, 14, 30, 0] as const;
export type RemindEvery = (typeof REMIND_CHOICES)[number];
export const DEFAULT_EVERY: RemindEvery = 14;
/** "Để sau" ẩn nhắc 3 ngày. */
export const SNOOZE_DAYS = 3;
const DAY_MS = 86_400_000;

export interface ReminderState {
  /** ms, null = chưa sao lưu lần nào trên máy này. */
  lastAt: number | null;
  snoozeUntil: number;
  every: RemindEvery;
}

export const DEFAULT_REMINDER: ReminderState = { lastAt: null, snoozeUntil: 0, every: DEFAULT_EVERY };

export function normalizeEvery(v: unknown): RemindEvery {
  return (REMIND_CHOICES as readonly unknown[]).includes(v) ? (v as RemindEvery) : DEFAULT_EVERY;
}

const ms = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export function normalizeReminder(raw: { lastAt?: unknown; snoozeUntil?: unknown; every?: unknown }): ReminderState {
  return { lastAt: ms(raw.lastAt), snoozeUntil: ms(raw.snoozeUntil) ?? 0, every: normalizeEvery(raw.every) };
}

/** Ngày "YYYY-MM-DD" → ms lúc 00:00 giờ máy. */
const dayStart = (d: string) => new Date(`${d}T00:00:00`).getTime();

/**
 * Có hiện dải nhắc sao lưu không.
 * - Tắt (every = 0), hoặc chưa có ngày ôn nào → không.
 * - Đang hoãn ("Để sau") → không.
 * - Mốc tính: lần sao lưu gần nhất; chưa sao lưu lần nào thì tính từ ngày ôn đầu tiên.
 *   Nhắc khi đã qua ≥ `every` ngày kể từ mốc.
 */
export function shouldRemind(s: ReminderState, studyDays: readonly string[], now: number): boolean {
  if (!s.every || !studyDays.length) return false;
  if (now < s.snoozeUntil) return false;
  const first = [...studyDays].sort()[0]!;
  const since = s.lastAt ?? dayStart(first);
  return now - since >= s.every * DAY_MS;
}

/** Số ngày (làm tròn xuống) kể từ lần sao lưu gần nhất. */
export function daysSince(lastAt: number, now: number): number {
  return Math.max(0, Math.floor((now - lastAt) / DAY_MS));
}

export const snoozeUntil = (now: number) => now + SNOOZE_DAYS * DAY_MS;

/** "04/11/2026 14:30" theo vi-VN, giờ máy. */
export function fmtWhen(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const everyLabel = (e: RemindEvery) => (e ? `${e} ngày` : 'Tắt');
