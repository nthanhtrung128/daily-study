import { db, getSetting, type StudyDB } from './db';
import type { Grade } from './leitner';

/**
 * Tiếp tục phiên dở: iOS hay tắt PWA khi chạy nền. Lưu vị trí phiên đang chạy vào bảng `settings`
 * (một khóa), chỉ gồm id mục, vị trí, kết quả đã có — không lưu nội dung, không lưu trạng thái giữa chừng của thẻ.
 */
export const ACTIVE_KEY = 'session.active';
/** Phiên dở quá 12 giờ thì bỏ. */
export const RESUME_MAX_MS = 12 * 60 * 60 * 1000;

export type ActiveKind = 'mix' | 'tr' | 'en-phrase' | 'en-pattern' | 'speak';

/** Một mục trong phiên: id + thông tin xếp lịch (làn, tầng, giây ước tính) để dựng lại mục của phiên trộn. */
export interface SavedItem {
  id: string;
  lane?: 'tr' | 'en';
  tier?: string;
  secs?: number;
}

export interface SavedResult {
  /** Chỉ số trong `items`. */
  i: number;
  g: Grade | null;
  score?: number | null;
}

export interface ActiveSession {
  kind: ActiveKind;
  items: SavedItem[];
  /** Chỉ số mục tiếp theo cần làm. */
  pos: number;
  results: SavedResult[];
  t0: number;
  minutes: number;
  /** Lần lưu gần nhất (ms). */
  savedAt: number;
}

export function isFresh(s: ActiveSession, now: number): boolean {
  return now - s.savedAt >= 0 && now - s.savedAt <= RESUME_MAX_MS;
}

function isActive(v: unknown): v is ActiveSession {
  const s = v as ActiveSession | null;
  return !!s && typeof s === 'object' && typeof s.kind === 'string' && Array.isArray(s.items) && Array.isArray(s.results) && typeof s.pos === 'number' && typeof s.savedAt === 'number';
}

export interface Restored<T> {
  list: T[];
  pos: number;
  results: { item: T; g: Grade | null; score?: number | null }[];
  /** t0 dời theo thời gian đã ôn trước khi gián đoạn (không tính lúc app tắt). */
  t0: number;
}

/**
 * Dựng lại phiên từ id: mục không còn trong nội dung thì bỏ qua (vị trí và kết quả dời theo).
 * null nếu quá 12 giờ hoặc không còn mục nào để làm.
 */
export function restoreSession<T>(s: ActiveSession, look: (it: SavedItem) => T | undefined, now: number): Restored<T> | null {
  if (!isFresh(s, now)) return null;
  const list: T[] = [];
  const map = new Map<number, T>();
  let pos = 0;
  s.items.forEach((it, k) => {
    const v = look(it);
    if (v === undefined) return;
    map.set(k, v);
    list.push(v);
    if (k < s.pos) pos++;
  });
  if (pos >= list.length) return null;
  const results: Restored<T>['results'] = [];
  for (const r of s.results) {
    const item = map.get(r.i);
    if (item !== undefined) results.push({ item, g: r.g, ...(r.score !== undefined ? { score: r.score } : {}) });
  }
  return { list, pos, results, t0: now - Math.max(0, s.savedAt - s.t0) };
}

/** Trạng thái mới sau một lượt: dời tới `pos`, thêm kết quả (nếu có). */
export function advance(s: ActiveSession, pos: number, now: number, result?: SavedResult): ActiveSession {
  const results = result && !s.results.some((r) => r.i === result.i) ? [...s.results, result] : s.results;
  return { ...s, pos: Math.max(s.pos, pos), results, savedAt: now };
}

export async function loadActive(now: number, store: StudyDB = db): Promise<ActiveSession | null> {
  const v = await getSetting<unknown>(ACTIVE_KEY, null, store);
  if (!isActive(v)) return null;
  if (!isFresh(v, now)) {
    await store.settings.delete(ACTIVE_KEY);
    return null;
  }
  return v;
}

export async function saveActive(s: ActiveSession, store: StudyDB = db): Promise<void> {
  await store.settings.put({ key: ACTIVE_KEY, value: s });
}

export async function clearActive(store: StudyDB = db): Promise<void> {
  await store.settings.delete(ACTIVE_KEY);
}
