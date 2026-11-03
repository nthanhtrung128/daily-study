import { describe, expect, it } from 'vitest';
import { applyGrade, INTERVALS, isDue, levelOf } from '../../src/core/leitner';
import { addDays, dayDiff, dayKey } from '../../src/core/date';

const T = '2026-11-03';

describe('Leitner', () => {
  it('nhớ rõ: lên 1 hộp, giãn 1/3/7/14/30 ngày, tối đa hộp 5', () => {
    let s = applyGrade(undefined, 2, T);
    const seen: [number, number][] = [];
    for (let k = 0; k < 6; k++) {
      seen.push([s.box, dayDiff(s.due, T)]);
      s = applyGrade(s, 2, T);
    }
    expect(seen).toEqual([[1, 1], [2, 3], [3, 7], [4, 14], [5, 30], [5, 30]]);
    expect(INTERVALS.slice(1)).toEqual([1, 3, 7, 14, 30]);
  });

  it('mơ hồ: ôn lại ngày mai, không vượt hộp 2, không xuống dưới 1', () => {
    expect(applyGrade(undefined, 1, T)).toMatchObject({ box: 1, due: '2026-11-04', wrong: 0 });
    expect(applyGrade({ box: 5, due: T, wrong: 2, last: 0 }, 1, T)).toMatchObject({ box: 2, due: '2026-11-04', wrong: 2 });
    expect(applyGrade({ box: 2, due: T, wrong: 0, last: 0 }, 1, T).box).toBe(2);
  });

  it('quên/sai: về hộp 1, đến hạn ngay, +1 lần sai', () => {
    const s = applyGrade({ box: 4, due: '2026-12-01', wrong: 1, last: 0 }, 0, T, 123);
    expect(s).toEqual({ box: 1, due: T, wrong: 2, last: 123 });
    expect(isDue(s, T)).toBe(true);
  });

  it('mức độ: chưa học / đang học / đã thuộc (hộp ≥ 4)', () => {
    expect(levelOf(undefined)).toBe(0);
    expect(levelOf({ box: 3, due: T, wrong: 0, last: 0 })).toBe(1);
    expect(levelOf({ box: 4, due: T, wrong: 0, last: 0 })).toBe(2);
    expect(isDue(undefined, T)).toBe(false);
    expect(isDue({ box: 2, due: '2026-11-04', wrong: 0, last: 0 }, T)).toBe(false);
  });

  it('ngày theo lịch, qua tháng/năm', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dayKey(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03');
  });
});
