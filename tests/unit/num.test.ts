import { describe, expect, it } from 'vitest';
import { fmt, isCorrect, parseNums } from '../../src/core/num';

describe('parseNums', () => {
  it.each([
    ['1.530.000 đ', [1530000]],
    ['1,530,000', [1530000]],
    ['12,5', [12.5]],
    ['12.5', [12.5]],
    ['15 %', [15]],
    ['15%', [15]],
    ['1530000', [1530000]],
    ['-3,2', [-3.2]],
    ['1.234,56', [1234.56]],
    ['1,234.56', [1234.56]],
    ['6,74 triệu', [6.74]],
  ])('%s → %j', (raw, want) => {
    expect(parseNums(raw)).toEqual(want);
  });

  it('"1.530" hiểu được cả nghìn kiểu VN lẫn thập phân', () => {
    expect(parseNums('1.530')).toEqual([1.53, 1530]);
    expect(parseNums('1,530')).toEqual([1.53, 1530]);
  });

  it('không phải số → rỗng', () => {
    expect(parseNums('')).toEqual([]);
    expect(parseNums('abc')).toEqual([]);
    expect(parseNums('12a')).toEqual([]);
  });

  it('chấm đúng trong dung sai', () => {
    expect(isCorrect('6,74', 6.7403, 0.01)).toBe(true);
    expect(isCorrect('6,76', 6.7403, 0.01)).toBe(false);
    expect(isCorrect('1.530', 1530, 1)).toBe(true);
    expect(isCorrect('1.530', 1.53, 0.01)).toBe(true);
  });

  it('định dạng vi-VN', () => {
    expect(fmt(1530000)).toBe('1.530.000');
    expect(fmt(12.5, 1)).toBe('12,5');
  });
});
