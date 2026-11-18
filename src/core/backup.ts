import { db as defaultDb, type DayStat, type ItemState, type Note, type Recording, type ReviewLog, type Setting, type StudyDB } from './db';
import { LOCAL_ONLY_KEYS } from './backupReminder';
import { LEARNED_BOX, MAX_BOX } from './leitner';
import { MISS_KEY, mergeMiss, normalizeMiss } from './misswords';
import { ROADMAP_REVIEW_PREFIX, readReviewChoice } from './roadmapReview';

/**
 * Xuất / nhập tiến độ dạng JSON — chỉ qua file trên máy, không gửi đi đâu.
 * Nhập được: (1) file do app này xuất; (2) state của Sổ ôn bản cũ (legacy/so-on-template.html),
 * vốn lưu ở localStorage["tr101.state.v1"] dạng
 *   { srs: { K001: [hộp, hạn "YYYY-MM-DD", số lần sai, ngày ôn cuối "YYYY-MM-DD"] , … },
 *     days: { "YYYY-MM-DD": { n, ok, s } }, notes: { K001: "…" }, prefs: { min, mode, bai }, updatedAt }.
 *
 * Bản ghi âm (tùy chọn khi xuất): thêm trường `recordings` — mảng { topicId, title, at, ms, mime, size, transcript?, data },
 * `data` là âm thanh mã hóa base64. Vẫn là `format: 1`: file không có `recordings` (file cũ, hoặc xuất không kèm ghi âm)
 * nhập như trước; app bản cũ đọc file mới thì bỏ qua trường lạ.
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
  recordings?: BackupRecording[];
}

/** Bản ghi âm trong file sao lưu: như `Recording` nhưng âm thanh là chuỗi base64, không có id. */
export interface BackupRecording {
  topicId: string;
  title: string;
  at: number;
  ms: number;
  mime: string;
  size: number;
  transcript?: string;
  data: string;
}

/** Bản ghi âm đọc từ file, đã giải mã (chưa có id). */
export type ImportedRecording = Omit<Recording, 'id'>;

export interface ParsedBackup {
  source: 'app' | 'legacy';
  items: ItemState[];
  days: DayStat[];
  notes: Note[];
  reviews: ReviewLog[];
  settings: Setting[];
  /** `undefined` = file không có trường ghi âm (khi thay thế sẽ giữ nguyên ghi âm trên máy). */
  recordings?: ImportedRecording[];
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

const EXTRA_DAY_FIELDS = ['st', 'se', 'sk', 'ks', 'kn', 'm'] as const;

function cleanDay(day: string, v: unknown): DayStat | null {
  if (!isDay(day) || !isObj(v)) return null;
  const n = int(v.n);
  if (n === null) return null;
  const nw = int(v.nw);
  const out: DayStat = { day, n, ok: Math.min(n, int(v.ok) ?? 0), s: int(v.s) ?? 0, ...(nw ? { nw: Math.min(n, nw) } : {}) };
  // Trường thời gian học / điểm nói / mục mới thuộc: tùy chọn, file cũ không có thì bỏ trống.
  for (const k of EXTRA_DAY_FIELDS) {
    const x = int(v[k]);
    if (x !== null) out[k] = x;
  }
  return out;
}

const MIME_RE = /^audio\/[\w.+-]+(\s*;.*)?$/i;

function cleanRecording(x: unknown): ImportedRecording | null {
  if (!isObj(x) || typeof x.topicId !== 'string' || !x.topicId || typeof x.data !== 'string') return null;
  const at = int(x.at);
  if (at === null) return null;
  let data: ArrayBuffer;
  try {
    data = fromBase64(x.data);
  } catch {
    return null;
  }
  if (!data.byteLength) return null;
  const mime = typeof x.mime === 'string' && MIME_RE.test(x.mime) ? x.mime : 'audio/mp4';
  const r: ImportedRecording = {
    topicId: x.topicId,
    title: typeof x.title === 'string' ? x.title : '',
    at,
    ms: int(x.ms) ?? 0,
    mime,
    size: data.byteLength,
    data,
  };
  if (typeof x.transcript === 'string' && x.transcript.trim()) r.transcript = x.transcript.trim();
  return r;
}

/** Base64 ← byte. Cắt khúc (bội số của 3) để không vượt giới hạn tham số của String.fromCharCode. */
export function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const CHUNK = 0x6000;
  const parts: string[] = [];
  for (let i = 0; i < u8.length; i += CHUNK) {
    parts.push(btoa(String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK) as unknown as number[])));
  }
  return parts.join('');
}

/** Byte ← base64 (bỏ khoảng trắng); chuỗi sai → lỗi. */
export function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/\s+/g, ''));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

/** Dung lượng base64 của n byte. */
export const b64Len = (n: number) => Math.ceil(n / 3) * 4;

/** Khóa nhận dạng bản ghi trùng khi gộp. */
const recKey = (r: Pick<Recording, 'topicId' | 'at' | 'size'>) => `${r.topicId}|${r.at}|${r.size}`;

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
    .filter(keep)
    .filter((x) => !LOCAL_ONLY_KEYS.has(x.key));
  const recordings = Array.isArray(raw.recordings) ? raw.recordings.map(cleanRecording).filter(keep) : undefined;
  return { source: 'app', items, days, notes, reviews, settings, skipped, ...(recordings ? { recordings } : {}) };
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

export interface ExportOptions {
  /** Kèm bản ghi âm (base64). */
  recordings?: boolean;
}

export async function exportBackup(store: StudyDB = defaultDb, now = new Date(), opts: ExportOptions = {}): Promise<Backup> {
  const [items, days, notes, reviews, settings, recs] = await Promise.all([
    store.items.toArray(),
    store.days.toArray(),
    store.notes.toArray(),
    store.reviews.toArray(),
    store.settings.toArray(),
    opts.recordings ? store.recordings.orderBy('at').toArray() : Promise.resolve([]),
  ]);
  const out: Backup = {
    app: APP_ID,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    items,
    days,
    notes,
    // Bỏ khóa tự tăng để nhập lại không đụng id.
    reviews: reviews.map(({ itemId, day, grade, at }) => ({ itemId, day, grade, at })),
    // Thời điểm sao lưu / hoãn nhắc là của riêng máy này, không mang theo.
    settings: settings.filter((x) => !LOCAL_ONLY_KEYS.has(x.key)),
  };
  if (opts.recordings) {
    out.recordings = recs.map((r) => ({
      topicId: r.topicId,
      title: r.title,
      at: r.at,
      ms: r.ms,
      mime: r.mime,
      size: r.data.byteLength,
      ...(r.transcript ? { transcript: r.transcript } : {}),
      data: toBase64(r.data),
    }));
  }
  return out;
}

/**
 * Nội dung file sao lưu, cắt thành nhiều đoạn cho `new Blob(parts)` / `new File(parts)`:
 * mỗi bản ghi âm một đoạn, tránh dựng một chuỗi khổng lồ (đỡ tốn bộ nhớ trên iPhone).
 */
export function backupParts(b: Backup): string[] {
  const { recordings, ...rest } = b;
  const head = JSON.stringify(rest, null, 1);
  if (!recordings) return [head];
  const parts = [head.replace(/\n?}$/, ''), ',\n "recordings": ['];
  recordings.forEach((r, i) => parts.push(`${i ? ',' : ''}\n  ${JSON.stringify(r)}`));
  parts.push('\n ]\n}');
  return parts;
}

/** Ước tính dung lượng (byte) phần ghi âm trong file sao lưu. */
export function estimateRecordingsBytes(rows: Pick<Recording, 'size' | 'title' | 'transcript'>[]): number {
  return rows.reduce((s, r) => s + b64Len(r.size) + 160 + r.title.length * 2 + (r.transcript?.length ?? 0) * 2, 0);
}

/** Thống kê ghi âm trên máy (để hiện "Kèm bản ghi âm (≈ X MB)"). */
export async function recordingStats(store: StudyDB = defaultDb): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;
  await store.recordings.each((r) => {
    count++;
    bytes += estimateRecordingsBytes([r]);
  });
  return { count, bytes };
}

/** Ngưỡng cảnh báo file lớn (byte): trên iPhone, đọc / lưu file cỡ này có thể chậm hoặc làm Safari tải lại trang. */
export const LARGE_FILE_BYTES = 50 * 1024 * 1024;

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
  recordings: number;
  firstDay: string;
  lastDay: string;
}

export function summarize(d: Pick<ParsedBackup, 'items' | 'days' | 'notes'> & { recordings?: unknown[] | undefined }): BackupSummary {
  const days = d.days.filter((x) => x.n > 0).map((x) => x.day).sort();
  return {
    items: d.items.filter((i) => i.box > 0).length,
    learned: d.items.filter((i) => i.box >= LEARNED_BOX).length,
    wrong: d.items.filter((i) => i.wrong > 0).length,
    days: days.length,
    reviews: d.days.reduce((s, x) => s + x.n, 0),
    notes: d.notes.length,
    recordings: d.recordings?.length ?? 0,
    firstDay: days[0] ?? '',
    lastDay: days[days.length - 1] ?? '',
  };
}

/**
 * Ghi dữ liệu nhập vào IndexedDB.
 * - replace: xóa tiến độ, nhật ký, ghi chú hiện có rồi ghi dữ liệu mới (cài đặt có trong file thì ghi đè).
 * - merge: mỗi mục giữ bản ôn gần nhất; thống kê ngày lấy số lớn hơn; ghi chú giữ bản mới hơn;
 *   nhật ký ôn thêm các lượt chưa có.
 * Ghi âm (chỉ khi file có trường `recordings`): thay thế → xóa ghi âm trên máy rồi ghi bản trong file;
 * gộp → thêm bản chưa có (trùng = cùng đề, cùng thời điểm, cùng dung lượng). File không có ghi âm → giữ nguyên ghi âm trên máy.
 */
export async function applyBackup(data: ParsedBackup, mode: ImportMode, store: StudyDB = defaultDb): Promise<void> {
  const tables = [store.items, store.days, store.notes, store.reviews, store.settings, store.recordings];
  await store.transaction('rw', tables, async () => {
    const recs = data.recordings;
    if (recs) {
      if (mode === 'replace') {
        await store.recordings.clear();
        await store.recordings.bulkAdd(recs.map((r) => ({ ...r })));
      } else {
        const have = new Set<string>();
        await store.recordings.each((r) => have.add(recKey({ ...r, size: r.data.byteLength })));
        const add = recs.filter((r) => {
          const k = recKey(r);
          if (have.has(k)) return false;
          have.add(k);
          return true;
        });
        await store.recordings.bulkAdd(add.map((r) => ({ ...r })));
      }
    }
    if (mode === 'replace') {
      await Promise.all([store.items.clear(), store.days.clear(), store.notes.clear(), store.reviews.clear()]);
      await store.items.bulkPut(data.items);
      await store.days.bulkPut(data.days);
      await store.notes.bulkPut(data.notes);
      await store.reviews.bulkAdd(data.reviews.map(({ itemId, day, grade, at }) => ({ itemId, day, grade, at })));
      // "Từ hay sai" là tiến độ: file không có (bản sao lưu cũ) thì xóa bản trên máy cho khớp tiến độ vừa thay.
      if (!data.settings.some((x) => x.key === MISS_KEY)) await store.settings.delete(MISS_KEY);
      await store.settings.where('key').startsWith(ROADMAP_REVIEW_PREFIX).delete();
      await store.settings.bulkPut(data.settings.filter((x) => !LOCAL_ONLY_KEYS.has(x.key)));
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
        if (!c) return d;
        // Gộp: lấy số lớn hơn theo từng trường; riêng điểm nói lấy cả cặp (tổng, số lần) của bên có nhiều lần hơn.
        const out: DayStat = { day: d.day, n: Math.max(c.n, d.n), ok: Math.max(c.ok, d.ok), s: Math.max(c.s, d.s) };
        for (const k of ['nw', 'st', 'se', 'sk', 'm'] as const) {
          if (c[k] !== undefined || d[k] !== undefined) out[k] = Math.max(c[k] ?? 0, d[k] ?? 0);
        }
        const k = (d.kn ?? 0) > (c.kn ?? 0) ? d : c;
        if (k.kn !== undefined) Object.assign(out, { ks: k.ks ?? 0, kn: k.kn });
        return out;
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
    // "Từ hay sai": gộp theo từ, lấy số lần lớn hơn.
    const inMiss = data.settings.find((s) => s.key === MISS_KEY);
    const curMiss = inMiss && (await store.settings.get(MISS_KEY));
    if (inMiss && curMiss) await store.settings.put({ key: MISS_KEY, value: mergeMiss(normalizeMiss(curMiss.value), normalizeMiss(inMiss.value)) });
    const currentSettings = new Map((await store.settings.toArray()).map((s) => [s.key, s.value]));
    await store.settings.bulkPut(data.settings.filter((s) => {
      if (LOCAL_ONLY_KEYS.has(s.key)) return false;
      if (s.key.startsWith(ROADMAP_REVIEW_PREFIX)) {
        const incoming = readReviewChoice(s.value);
        const current = readReviewChoice(currentSettings.get(s.key));
        return !!incoming && incoming.at > (current?.at ?? 0);
      }
      // Giữ cài đặt hiện có. Lịch ôn ở trên là tiến độ nên lấy thao tác mới nhất.
      return !currentSettings.has(s.key);
    }));
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
