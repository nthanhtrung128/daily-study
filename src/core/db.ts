import Dexie, { type EntityTable } from 'dexie';

/**
 * Lưu trữ cục bộ (IndexedDB) — tiến độ, nhật ký ôn, cài đặt, ghi chú. Không gửi dữ liệu ra ngoài.
 * v1 (S1): items, reviews, settings. v2 (S2): thêm days (thống kê theo ngày) và notes.
 * v3 (S6): thêm recordings (bản ghi âm đề nói, lưu dạng ArrayBuffer để chạy cả trên Safari cũ).
 */

/** Trạng thái Leitner của một mục (thẻ TR, câu trắc nghiệm, cụm từ EN…). */
export interface ItemState {
  /** Khóa mục, vd "tr:K001", "en:vocab:123". */
  id: string;
  /** Hộp Leitner 1–5. */
  box: number;
  /** Ngày đến hạn ôn, dạng YYYY-MM-DD theo giờ máy. */
  due: string;
  /** Số lần sai/quên. */
  wrong: number;
  /** Thời điểm ôn gần nhất (ms). */
  last: number;
}

/** Một lượt ôn, dùng để tính chuỗi ngày và bản đồ nhiệt. */
export interface ReviewLog {
  id?: number;
  itemId: string;
  /** Ngày ôn YYYY-MM-DD. */
  day: string;
  /** 0 = quên/sai, 1 = mơ hồ, 2 = nhớ rõ/đúng. */
  grade: 0 | 1 | 2;
  at: number;
}

/** Thống kê một ngày: số lượt ôn, số lượt nhớ rõ/đúng, số giây ôn. */
export interface DayStat {
  day: string;
  n: number;
  ok: number;
  s: number;
  /** Số mục mới (lần đầu chấm) trong ngày — dùng cho giới hạn mục mới/ngày (S8). Bản cũ không có → 0. */
  nw?: number;
  /** Giây học thực tế (bỏ khoảng nghỉ > 2 phút), tách TR / tiếng Anh / nói. Bản cũ không có → dùng `s`. */
  st?: number;
  se?: number;
  sk?: number;
  /** Điểm nói: tổng điểm (%) và số lần chấm trong ngày, để tính trung bình. */
  ks?: number;
  kn?: number;
  /** Số lượt mục lên mức "Đã thuộc" (hộp < 4 → ≥ 4) trong ngày. */
  m?: number;
}

export interface Note {
  id: string;
  text: string;
  at: number;
}

/** Một bản ghi âm đề nói (chỉ lưu trên máy). */
export interface Recording {
  id?: number;
  /** Id đề nói, vd "st-0001". */
  topicId: string;
  /** Đề bài (lưu kèm để vẫn hiển thị được nếu đề đổi / bị xóa). */
  title: string;
  at: number;
  /** Độ dài (ms). */
  ms: number;
  mime: string;
  size: number;
  data: ArrayBuffer;
  transcript?: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class StudyDB extends Dexie {
  items!: EntityTable<ItemState, 'id'>;
  reviews!: EntityTable<ReviewLog, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  days!: EntityTable<DayStat, 'day'>;
  notes!: EntityTable<Note, 'id'>;
  recordings!: EntityTable<Recording, 'id'>;

  constructor(name = 'daily-study') {
    super(name);
    this.version(1).stores({
      items: 'id, box, due',
      reviews: '++id, itemId, day',
      settings: 'key',
    });
    this.version(2).stores({
      days: 'day',
      notes: 'id',
    });
    this.version(3).stores({
      recordings: '++id, topicId, at',
    });
  }
}

export const db = new StudyDB();

/** Lỗi do hết dung lượng lưu trữ (Dexie bọc lỗi gốc trong `inner`). */
export function isQuotaError(e: unknown): boolean {
  for (let x = e as { name?: string; message?: string; inner?: unknown } | null | undefined, i = 0; x && i < 4; x = x.inner as typeof x, i++) {
    if (x.name === 'QuotaExceededError' || /quota/i.test(x.message ?? '')) return true;
  }
  return false;
}

export async function getSetting<T>(key: string, fallback: T, store: StudyDB = db): Promise<T> {
  const row = await store.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown, store: StudyDB = db): Promise<void> {
  await store.settings.put({ key, value });
}
