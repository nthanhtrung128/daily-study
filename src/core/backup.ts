import { db as defaultDb, type DayStat, type ItemState, type Note, type ReviewLog, type Setting, type StudyDB } from './db';
import { LEARNED_BOX, MAX_BOX } from './leitner';

/**
 * Xuất / nhập tiến độ dạng JSON — chỉ qua file trên máy, không gửi đi đâu.
 * Nhập được: (1) file do app này xuất; (2) state của Sổ ôn bản cũ (legacy/so-on-template.html),
 * vốn lưu ở localStorage["tr101.state.v1"] dạng
 *   { srs: { K001: [hộp, hạn "YYYY-MM-DD", số lần sai, ngày ôn cuối "YYYY-MM-DD"] , … },
 *     days: { "YYYY-MM-DD": { n, ok, s } }, notes: { K001: "…" }, prefs: { min, mode, bai }, updatedAt }.
 */
export const APP_ID = 'daily-study';
export const BACKUP_FORMAT = 1;
export const LEGACY_KEY = 'tr101.state.v1';
/** Khóa cài đặt TR dùng ở trang Hôm nay (S2). */
const TR_PREFS_KEY = 'tr.prefs';

export interface Backup {
  app: typeof APP_ID;
  format: number;
  exportedAt: string;
  items: ItemState[];
  days: DayStat[];
  notes: Note[];
  reviews: ReviewLog[];
  settings: Setting[];
}

export interface ParsedBackup {
  source: 'app' | 'legacy';
  items: ItemState[];
  days: DayStat[];
  notes: Note[];
  reviews: ReviewLog[];
  settings: Setting[];
  /** Số dòng bị bỏ vì sai định dạng. */
  skipped: number;
}

export type ImportMode = 'replace' | 'merge';

export class BackupError extends Error {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v);
const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
};
/** Ngày "YYYY-MM-DD" → ms lúc 12:00 giờ máy (bản cũ chỉ lưu ngày ôn cuối). */
const dayToMs = (d: string) => new Date(`${d}T12:00:00`).getTime();

function cleanItem(id: string, box: unknown, due: unknown, wrong: unknown, last: unknown): ItemState | null {
  const b = int(box, 0, MAX_BOX);
  if (!id || b === null || !isDay(due)) return null;
  const l = isDay(last) ? dayToMs(last) : (int(last) ?? 0);
  return { id, box: b, due, wrong: int(wrong) ?? 0, last: l };
}

function cleanDay(day: string, v: unknown): DayStat | null {
  if (!isDay(day) || !isObj(v)) return null;
  const n = int(v.n);
  if (n === null) return null;
  return { day, n, ok: Math.min(n, int(v.ok) ?? 0), s: int(v.s) ?? 0 };
}

/** Thêm tiền tố "tr:" cho id bản cũ (K001, F01, Q001, M01, G001, C-mid…). */
export const legacyId = (id: string) => (/^(tr|en):/.test(id) ? id : `tr:${id}`);

/** Chuyển state bản cũ sang dữ liệu của app. */
export function fromLegacy(raw: unknown): ParsedBackup {
  if (!isObj(raw) || !isObj(raw.srs)) throw new BackupError('Không phải state của Sổ ôn bản cũ (thiếu "srs").');
  let skipped = 0;
  const items: ItemState[] = [];
  for (const [id, s] of Object.entries(raw.srs)) {
    const it = Array.isArray(s)
      ? cleanItem(legacyId(id), s[0], s[1], s[2], s[3])
      : isObj(s)
        ? cleanItem(legacyId(id), s.box, s.due, s.wrong, s.last)
        : null;
    if (it) items.push(it);
    else skipped++;
  }
  const days: DayStat[] = [];
  for (const [day, v] of Object.entries(isObj(raw.days) ? raw.days : {})) {
    const d = cleanDay(day, v);
    if (d) days.push(d);
    else skipped++;
  }
  const at = int(raw.updatedAt) || Date.now();
  const notes: Note[] = [];
  for (const [id, text] of Object.entries(isObj(raw.notes) ? raw.notes : {})) {
    if (typeof text === 'string' && text.trim()) notes.push({ id: legacyId(id), text, at });
    else skipped++;
  }
  const settings: Setting[] = [];
  if (isObj(raw.prefs)) {
    const p = raw.prefs;
    const min = int(p.min, 1, 120);
    settings.push({
      key: TR_PREFS_KEY,
      value: {
        min: min ?? 10,
        mode: typeof p.mode === 'string' ? p.mode : 'mix',
        bai: Array.isArray(p.bai) ? p.bai.filter((x): x is string => typeof x === 'string') : [],
      },
    });
  }
  return { source: 'legacy', items, days, notes, reviews: [], settings, skipped };
}

function fromApp(raw: Record<string, unknown>): ParsedBackup {
  const fmt = int(raw.format);
  if (fmt === null || fmt > BACKUP_FORMAT) throw new BackupError('File được xuất từ phiên bản app mới hơn, hãy cập nhật app rồi thử lại.');
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  let skipped = 0;
  const keep = <T>(v: T | null): v is T => (v === null ? (skipped++, false) : true);
  const items = arr(raw.items)
    .map((x) => (isObj(x) && typeof x.id === 'string' ? cleanItem(x.id, x.box, x.due, x.wrong, x.last) : null))
    .filter(keep);
  const days = arr(raw.days)
    .map((x) => (isObj(x) && typeof x.day === 'string' ? cleanDay(x.day, x) : null))
    .filter(keep);
  const notes = arr(raw.notes)
    .map((x): Note | null =>
      isObj(x) && typeof x.id === 'string' && typeof x.text === 'string' && x.text.trim() ? { id: x.id, text: x.text, at: int(x.at) ?? 0 } : null,
    )
    .filter(keep);
  const reviews = arr(raw.reviews)
    .map((x): ReviewLog | null => {
      if (!isObj(x) || typeof x.itemId !== 'string' || !isDay(x.day)) return null;
      const g = int(x.grade, 0, 2);
      return g === null ? null : { itemId: x.itemId, day: x.day, grade: g as 0 | 1 | 2, at: int(x.at) ?? 0 };
    })
    .filter(keep);
  const settings = arr(raw.settings)
    .map((x): Setting | null => (isObj(x) && typeof x.key === 'string' && 'value' in x ? { key: x.key, value: x.value } : null))
    .filter(keep);
  return { source: 'app', items, days, notes, reviews, settings, skipped };
}

/** Đọc nội dung file JSON: tự nhận dạng file của app hay state bản cũ. */
export function parseBackup(input: string | unknown): ParsedBackup {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input.replace(/^\uFEFF/, ''));
    } catch {
      throw new BackupError('File không phải JSON hợp lệ.');
    }
  }
  if (isObj(raw) && raw.app === APP_ID) return fromApp(raw);
  if (isObj(raw) && isObj(raw.srs)) return fromLegacy(raw);
  throw new BackupError('Không nhận ra định dạng: cần file xuất từ app này hoặc state của Sổ ôn bản cũ.');
}

export async function exportBackup(store: StudyDB = defaultDb, now = new Date()): Promise<Backup> {
  const [items, days, notes, reviews, settings] = await Promise.all([
    store.items.toArray(),
    store.days.toArray(),
    store.notes.toArray(),
    store.reviews.toArray(),
    store.settings.toArray(),
  ]);
  return {
    app: APP_ID,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    items,
    days,
    notes,
    // Bỏ khóa tự tăng để nhập lại không đụng id.
    reviews: reviews.map(({ itemId, day, grade, at }) => ({ itemId, day, grade, at })),
    settings,
  };
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `daily-study-tien-do-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

export interface BackupSummary {
  items: number;
  learned: number;
  wrong: number;
  days: number;
  reviews: number;
  notes: number;
  firstDay: string;
  lastDay: string;
}

export function summarize(d: Pick<ParsedBackup, 'items' | 'days' | 'notes'>): BackupSummary {
  const days = d.days.filter((x) => x.n > 0).map((x) => x.day).sort();
  return {
    items: d.items.filter((i) => i.box > 0).length,
    learned: d.items.filter((i) => i.box >= LEARNED_BOX).length,
    wrong: d.items.filter((i) => i.wrong > 0).length,
    days: days.length,
    reviews: d.days.reduce((s, x) => s + x.n, 0),
    notes: d.notes.length,
    firstDay: days[0] ?? '',
    lastDay: days[days.length - 1] ?? '',
  };
}

/**
 * Ghi dữ liệu nhập vào IndexedDB.
 * - replace: xóa tiến độ, nhật ký, ghi chú hiện có rồi ghi dữ liệu mới (cài đặt có trong file thì ghi đè).
 * - merge: mỗi mục giữ bản ôn gần nhất; thống kê ngày lấy số lớn hơn; ghi chú giữ bản mới hơn;
 *   nhật ký ôn thêm các lượt chưa có.
 */
export async function applyBackup(data: ParsedBackup, mode: ImportMode, store: StudyDB = defaultDb): Promise<void> {
  await store.transaction('rw', [store.items, store.days, store.notes, store.reviews, store.settings], async () => {
    if (mode === 'replace') {
      await Promise.all([store.items.clear(), store.days.clear(), store.notes.clear(), store.reviews.clear()]);
      await store.items.bulkPut(data.items);
      await store.days.bulkPut(data.days);
      await store.notes.bulkPut(data.notes);
      await store.reviews.bulkAdd(data.reviews.map(({ itemId, day, grade, at }) => ({ itemId, day, grade, at })));
      await store.settings.bulkPut(data.settings);
      return;
    }
    const [items, days, notes, reviews] = await Promise.all([
      store.items.toArray(),
      store.days.toArray(),
      store.notes.toArray(),
      store.reviews.toArray(),
    ]);
    const curItem = new Map(items.map((i) => [i.id, i]));
    await store.items.bulkPut(
      data.items.filter((i) => {
        const c = curItem.get(i.id);
        return !c || i.last > c.last || (i.last === c.last && i.box > c.box);
      }),
    );
    const curDay = new Map(days.map((d) => [d.day, d]));
    await store.days.bulkPut(
      data.days.map((d) => {
        const c = curDay.get(d.day);
        return c ? { day: d.day, n: Math.max(c.n, d.n), ok: Math.max(c.ok, d.ok), s: Math.max(c.s, d.s) } : d;
      }),
    );
    const curNote = new Map(notes.map((n) => [n.id, n]));
    await store.notes.bulkPut(
      data.notes.filter((n) => {
        const c = curNote.get(n.id);
        return !c || !c.text.trim() || (n.at > c.at && n.text !== c.text);
      }),
    );
    const seen = new Set(reviews.map((r) => `${r.itemId}|${r.at}|${r.grade}`));
    await store.reviews.bulkAdd(
      data.reviews
        .filter((r) => !seen.has(`${r.itemId}|${r.at}|${r.grade}`))
        .map(({ itemId, day, grade, at }) => ({ itemId, day, grade, at })),
    );
    // Gộp: chỉ thêm cài đặt chưa có, không đè lựa chọn hiện tại.
    const keys = new Set((await store.settings.toArray()).map((s) => s.key));
    await store.settings.bulkPut(data.settings.filter((s) => !keys.has(s.key)));
  });
}

/** State bản cũ nếu Sổ ôn từng chạy trên cùng trình duyệt và cùng địa chỉ (localStorage). */
export function readLegacyLocal(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): string | null {
  try {
    const v = storage?.getItem(LEGACY_KEY) ?? null;
    return v && v.includes('"srs"') ? v : null;
  } catch {
    return null;
  }
}
