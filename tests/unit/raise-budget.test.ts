import { expect, it } from 'vitest';
import { raiseBudget, readAmount } from '../../src/modules/tr/raiseBudget';

it('tính đủ tháng hiệu lực và giữ riêng số tiền đủ năm', () => {
  expect(raiseBudget(50, 3, 7)).toEqual({ months: 6, year: 180, full: 360 });
  expect(raiseBudget(50, 2, 10)?.year).toBe(60);
  expect(raiseBudget(1, 2.5, 12)).toEqual({ months: 1, year: 0.5, full: 6 });
  expect(raiseBudget(50, 3, 1)?.year).toBe(360);
  expect(raiseBudget(0, 3, 1)?.full).toBe(0);
  expect(raiseBudget(1.5, 2, 10)).toBeUndefined();
  expect(raiseBudget(10, 3, 13)).toBeUndefined();
  expect(readAmount('2,50')).toBe(2.5);
  expect(readAmount('2x')).toBeUndefined();
});
