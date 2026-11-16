import { db as defaultDb, getSetting, setSetting, type StudyDB } from './db';

/**
 * "Từ hay sai": đếm theo từ các từ bị chấm sai / thiếu khi luyện nói và nghe chép.
 * Lưu một khóa trong bảng `settings` (`en.missWords`) nên tự nằm trong file sao lưu; không đổi bảng Dexie nào.
 * Mỗi lần từ bị sai/thiếu: +1. Mỗi lần nói/chép đúng từ đó: −1 (về 0 thì xóa) → luyện đúng thì độ yếu giảm.
 */
export const MISS_KEY = 'en.missWords';
export interface MissStat {
  n: number;
  /** Lần sai gần nhất (ms). */
  at: number;
}
export type MissMap = Record<string, MissStat>;

/** Từ chức năng quá phổ biến: không đếm (câu nào cũng chứa, không giúp chọn câu luyện). */
const SKIP = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'is', 'am', 'are', 'it', 'and', 'or', 'i', 'we', 'you', 'be', 'do', 'for']);
export const MISS_MAX_WORDS = 300;

/** Chuẩn hóa một từ hiển thị: chữ thường, bỏ dấu câu hai đầu, nháy cong → nháy thẳng. */
export const wordKey = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

export const wordKeys = (sentence: string): string[] => sentence.split(/\s+/).map(wordKey).filter(Boolean);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Dữ liệu hỏng / từ file sao lưu lạ → bản đồ hợp lệ. */
export function normalizeMiss(raw: unknown): MissMap {
  const out: MissMap = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const w = wordKey(k);
    if (!w || !isObj(v) || typeof v.n !== 'number' || !Number.isFinite(v.n) || v.n < 1) continue;
    out[w] = { n: Math.round(v.n), at: typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : 0 };
  }
  return out;
}

/** Áp kết quả chấm một câu (hàm thuần): từ sai / thiếu +1, từ đúng −1. */
export function applyMarks(map: MissMap, words: readonly { text: string; status: string }[], now: number): MissMap {
  const out: MissMap = { ...map };
  for (const w of words) {
    const k = wordKey(w.text);
    if (!k || SKIP.has(k)) continue;
    const cur = out[k];
    if (w.status !== 'ok') out[k] = { n: (cur?.n ?? 0) + 1, at: now };
    else if (cur) {
      if (cur.n <= 1) delete out[k];
      else out[k] = { ...cur, n: cur.n - 1 };
    }
  }
  const keys = Object.keys(out);
  if (keys.length > MISS_MAX_WORDS) {
    // Giữ các từ sai nhiều / gần đây nhất.
    for (const k of keys.sort((a, b) => out[b]!.n - out[a]!.n || out[b]!.at - out[a]!.at).slice(MISS_MAX_WORDS)) delete out[k];
  }
  return out;
}

/** Từ sai nhiều nhất trước; bằng nhau thì sai gần đây hơn trước, rồi theo chữ cái. */
export function topMissed(map: MissMap, top = 10): { word: string; n: number }[] {
  return Object.entries(map)
    .sort((a, b) => b[1].n - a[1].n || b[1].at - a[1].at || (a[0] < b[0] ? -1 : 1))
    .slice(0, top)
    .map(([word, s]) => ({ word, n: s.n }));
}

/** Gộp hai bản đồ (nhập sao lưu kiểu "gộp"): mỗi từ lấy số lần lớn hơn. */
export function mergeMiss(a: MissMap, b: MissMap): MissMap {
  const out: MissMap = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const c = out[k];
    out[k] = c ? { n: Math.max(c.n, v.n), at: Math.max(c.at, v.at) } : v;
  }
  return out;
}

/**
 * Chọn câu chứa các từ hay sai: điểm câu = tổng số lần sai của các từ (chưa được câu trước phủ) có trong câu;
 * lấy câu điểm cao nhất, bỏ các từ đã phủ, lặp lại. Bằng điểm thì câu `prefer` (độ dài vừa) trước, rồi theo thứ tự danh sách.
 */
export function pickSentences<T extends { en: string }>(map: MissMap, items: readonly T[], max: number, prefer: (it: T) => boolean = () => true): T[] {
  const left = new Map(Object.entries(map).map(([k, v]) => [k, v.n]));
  const pool = items.map((it, i) => ({ it, i, keys: new Set(wordKeys(it.en)), pref: prefer(it) ? 0 : 1 }));
  const out: T[] = [];
  const used = new Set<number>();
  while (out.length < max && left.size) {
    let best: (typeof pool)[number] | null = null;
    let bestScore = 0;
    for (const c of pool) {
      if (used.has(c.i)) continue;
      let s = 0;
      for (const k of c.keys) s += left.get(k) ?? 0;
      if (s > bestScore || (s > 0 && s === bestScore && best && c.pref < best.pref)) {
        best = c;
        bestScore = s;
      }
    }
    if (!best) break;
    used.add(best.i);
    out.push(best.it);
    for (const k of best.keys) left.delete(k);
  }
  return out;
}

/** Bản đồ từ sai trong bộ nhớ, đồng bộ xuống `settings`. Dùng với useSyncExternalStore. */
export class MissStore {
  private map: MissMap = {};
  private listeners = new Set<() => void>();
  private pending: Promise<unknown> = Promise.resolve();
  private early: { words: readonly { text: string; status: string }[]; at: number }[] = [];
  loaded = false;

  constructor(private store: StudyDB = defaultDb) {}

  async load(): Promise<void> {
    let saved: MissMap = {};
    try {
      saved = normalizeMiss(await getSetting<unknown>(MISS_KEY, null, this.store));
    } catch {
      // IndexedDB bị chặn: chỉ giữ trong bộ nhớ.
    }
    this.map = saved;
    this.loaded = true;
    const early = this.early;
    this.early = [];
    for (const e of early) this.record(e.words, e.at);
    this.emit();
  }

  get = (): MissMap => this.map;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    for (const fn of this.listeners) fn();
  }

  /** Ghi kết quả chấm một câu (nói hoặc nghe chép). */
  record(words: readonly { text: string; status: string }[], at = Date.now()): void {
    if (!this.loaded) this.early.push({ words, at });
    this.map = applyMarks(this.map, words, at);
    this.emit();
    if (!this.loaded) return;
    const snap = this.map;
    this.pending = this.pending.then(() => setSetting(MISS_KEY, snap, this.store)).catch(() => undefined);
  }

  flush(): Promise<unknown> {
    return this.pending;
  }
}

export const missStore = new MissStore();
