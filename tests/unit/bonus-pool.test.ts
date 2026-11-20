import { expect, it } from 'vitest';
import { allocateBonus, samplePeople } from '../../src/modules/tr/bonusPool';

it('chia đúng quỹ Excel sau khi xử lý phần dư đến 0,01 triệu', () => {
  const result = allocateBonus('300', samplePeople());
  expect(result.points).toBeCloseTo(218.4);
  expect(result.rows?.map((r) => r.amount)).toEqual([98.90, 82.42, 54.40, 39.56, 24.72]);
  expect(result.paid).toBe(300);
  expect(result.unallocated).toBe(0);
});

it('xử lý đồng hạng, quỹ bằng 0 và không có điểm dương', () => {
  const people = samplePeople().slice(0, 3).map((row) => ({ ...row, target: '1', eligible: '100', factor: '1' }));
  expect(allocateBonus('0,02', people).rows?.map((r) => r.amount)).toEqual([0.01, 0.01, 0]);
  expect(allocateBonus('0', people)).toMatchObject({ paid: 0, unallocated: 0 });
  expect(allocateBonus('300', people.map((p) => ({ ...p, eligible: '0' })))).toMatchObject({ paid: 0, unallocated: 300 });
});

it('từ chối dữ liệu trống, âm, thời gian quá 100% và số tiền vượt độ chính xác', () => {
  const people = samplePeople();
  for (const input of ['', '-1', '0.001']) expect(allocateBonus(input, people).error).toBeTruthy();
  expect(allocateBonus('300', [{ ...people[0]!, eligible: '100,01' }]).error).toContain('NV01');
});
