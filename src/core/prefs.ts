/**
 * Cài đặt phiên hằng ngày (S8) — lưu trong bảng `settings` của IndexedDB, khóa `daily.prefs`.
 * Hàm `normalizePrefs` thuần: dữ liệu hỏng / thiếu / từ bản sao lưu cũ đều về giá trị hợp lệ.
 */
export const DAILY_DURATIONS = [10, 15, 20, 30] as const;
/** Mục tiêu phút học mỗi ngày. */
export const GOAL_CHOICES = [5, 10, 15, 20, 30] as const;
export const MAX_NEW_CHOICES = [0, 5, 10, 20, 30, 50] as const;
/** 0 = Chủ nhật … 6 = Thứ bảy (như Date.getDay). Thứ tự hiển thị T2 → CN. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_SHORT_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

export interface DailyPrefs {
  /** Thời lượng mặc định (phút). */
  min: number;
  /** Tỉ lệ thời gian TR (0–1); phần còn lại là tiếng Anh. */
  trShare: number;
  /** Số mục mới tối đa mỗi ngày. */
  maxNew: number;
  /** Kèm 1 bài luyện nói trong phiên. */
  speak: boolean;
  /** Giờ nhắc "HH:MM". */
  remindAt: string;
  /** Các ngày nhắc trong tuần (0 = CN). */
  remindDays: number[];
  /** Mục tiêu phút học mỗi ngày. */
  goalMin: number;
  /** Ngày nghỉ trong tuần (0 = CN): không ôn cũng không đứt chuỗi. Tối đa 6 ngày. */
  restDays: number[];
}

export const DEFAULT_DAILY: DailyPrefs = {
  min: 15,
  trShare: 0.4,
  maxNew: 20,
  speak: true,
  remindAt: '20:30',
  remindDays: [1, 2, 3, 4, 5, 6, 0],
  goalMin: 15,
  restDays: [],
};

export const DAILY_KEY = 'daily.prefs';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function isTime(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export function normalizePrefs(raw: unknown): DailyPrefs {
  const r = isObj(raw) ? raw : {};
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const min = Math.round(num(r.min, 5, 60, DEFAULT_DAILY.min));
  // Tỉ lệ làm tròn bước 5% để thanh trượt và hiển thị khớp nhau.
  const trShare = Math.round(num(r.trShare, 0, 1, DEFAULT_DAILY.trShare) * 20) / 20;
  const maxNew = Math.round(num(r.maxNew, 0, 200, DEFAULT_DAILY.maxNew));
  const speak = typeof r.speak === 'boolean' ? r.speak : DEFAULT_DAILY.speak;
  const remindAt = isTime(r.remindAt) ? r.remindAt : DEFAULT_DAILY.remindAt;
  const dayList = (v: unknown, d: number[]) => {
    const days = Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 6) : d;
    return WEEK_ORDER.filter((x) => days.includes(x));
  };
  const remindDays = dayList(r.remindDays, DEFAULT_DAILY.remindDays);
  const goalMin = (GOAL_CHOICES as readonly number[]).includes(r.goalMin as number) ? (r.goalMin as number) : DEFAULT_DAILY.goalMin;
  // Không cho nghỉ cả 7 ngày (chuỗi sẽ vô nghĩa): giữ tối đa 6.
  const restDays = dayList(r.restDays, DEFAULT_DAILY.restDays).slice(0, 6);
  return { min, trShare, maxNew, speak, remindAt, remindDays, goalMin, restDays };
}

/** "TR 40% · Tiếng Anh 60%". */
export function shareLabel(trShare: number): string {
  const tr = Math.round(trShare * 100);
  return `TR ${tr}% · Tiếng Anh ${100 - tr}%`;
}
