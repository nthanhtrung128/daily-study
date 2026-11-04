import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER,
  daysSince,
  fmtWhen,
  normalizeReminder,
  shouldRemind,
  snoozeUntil,
  type ReminderState,
} from '../../src/core/backupReminder';

const at = (d: number, h = 9) => new Date(2026, 10, d, h).getTime();
const st = (over: Partial<ReminderState> = {}): ReminderState => ({ ...DEFAULT_REMINDER, ...over });

describe('khi nào nhắc sao lưu', () => {
  it('chưa có ngày ôn → không nhắc', () => {
    expect(shouldRemind(st(), [], at(30))).toBe(false);
  });

  it('chưa sao lưu lần nào: tính từ ngày ôn đầu tiên', () => {
    const days = ['2026-11-05', '2026-11-01'];
    expect(shouldRemind(st(), days, at(14, 23))).toBe(false);
    expect(shouldRemind(st(), days, at(15, 0))).toBe(true);
  });

  it('đã sao lưu: nhắc khi qua đủ chu kỳ 7 / 14 / 30 ngày', () => {
    const days = ['2026-10-01'];
    const last = at(1, 9);
    expect(shouldRemind(st({ lastAt: last, every: 14 }), days, at(15, 8))).toBe(false);
    expect(shouldRemind(st({ lastAt: last, every: 14 }), days, at(15, 9))).toBe(true);
    expect(shouldRemind(st({ lastAt: last, every: 7 }), days, at(8, 9))).toBe(true);
    expect(shouldRemind(st({ lastAt: last, every: 7 }), days, at(7, 9))).toBe(false);
    expect(shouldRemind(st({ lastAt: last, every: 30 }), days, at(30, 9))).toBe(false);
    expect(shouldRemind(st({ lastAt: last, every: 30 }), days, new Date(2026, 11, 1, 9).getTime())).toBe(true);
  });

  it('tắt nhắc → không bao giờ nhắc', () => {
    expect(shouldRemind(st({ every: 0 }), ['2025-01-01'], at(30))).toBe(false);
  });

  it('"Để sau" ẩn 3 ngày rồi nhắc lại', () => {
    const now = at(20);
    const s = st({ lastAt: at(1), snoozeUntil: snoozeUntil(now) });
    expect(shouldRemind(s, ['2026-11-01'], now)).toBe(false);
    expect(shouldRemind(s, ['2026-11-01'], at(23, 8))).toBe(false);
    expect(shouldRemind(s, ['2026-11-01'], at(23, 9))).toBe(true);
  });

  it('chuẩn hóa giá trị đọc từ IndexedDB', () => {
    expect(normalizeReminder({ lastAt: 'x', snoozeUntil: -1, every: 5 })).toEqual(DEFAULT_REMINDER);
    expect(normalizeReminder({ lastAt: 10, snoozeUntil: 20, every: 0 })).toEqual({ lastAt: 10, snoozeUntil: 20, every: 0 });
    expect(normalizeReminder({ every: 30 }).every).toBe(30);
  });

  it('định dạng ngày giờ vi-VN và số ngày', () => {
    expect(fmtWhen(new Date(2026, 10, 4, 7, 5).getTime())).toBe('04/11/2026 07:05');
    expect(daysSince(at(1), at(15, 8))).toBe(13);
    expect(daysSince(at(2), at(1))).toBe(0);
  });
});
