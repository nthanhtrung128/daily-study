import { describe, expect, it } from 'vitest';
import { streakCount } from '../../src/core/streak';

const of = (days: string[]) => (d: string) => (days.includes(d) ? 1 : 0);

describe('chuỗi ngày', () => {
  it('đếm liên tiếp tính cả hôm nay', () => {
    expect(streakCount(of(['2026-11-01', '2026-11-02', '2026-11-03']), '2026-11-03')).toBe(3);
  });
  it('hôm nay chưa ôn thì vẫn giữ chuỗi tới hôm qua', () => {
    expect(streakCount(of(['2026-11-01', '2026-11-02']), '2026-11-03')).toBe(2);
  });
  it('đứt khi bỏ 1 ngày', () => {
    expect(streakCount(of(['2026-10-31', '2026-11-02', '2026-11-03']), '2026-11-03')).toBe(2);
    expect(streakCount(of(['2026-11-01']), '2026-11-03')).toBe(0);
  });
  it('qua ranh giới tháng', () => {
    expect(streakCount(of(['2026-10-30', '2026-10-31', '2026-11-01']), '2026-11-01')).toBe(3);
  });
});
