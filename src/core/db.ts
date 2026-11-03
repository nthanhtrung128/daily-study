import Dexie, { type EntityTable } from 'dexie';

/**
 * Lưu trữ cục bộ (IndexedDB) — tiến độ, nhật ký ôn, cài đặt, ghi chú. Không gửi dữ liệu ra ngoài.
 * v1 (S1): items, reviews, settings. v2 (S2): thêm days (thống kê theo ngày) và notes.
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
}

export interface Note {
  id: string;
  text: string;
  at: number;
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
  }
}

export const db = new StudyDB();

export async function getSetting<T>(key: string, fallback: T, store: StudyDB = db): Promise<T> {
  const row = await store.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown, store: StudyDB = db): Promise<void> {
  await store.settings.put({ key, value });
}
