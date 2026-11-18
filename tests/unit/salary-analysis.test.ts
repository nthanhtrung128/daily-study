import { describe, expect, it } from 'vitest';
import { analyzeSalary, summarizeSalary } from '../../src/modules/tr/salaryAnalysis';
import m09 from '../../content/tr-roadmap/m09.json';

describe('phân tích dữ liệu đãi ngộ', () => {
  const partTime = m09.sample.find((row) => row.id === 'NV04')!;

  it('quy đổi lương trước khi so với dải và thị trường', () => {
    expect(analyzeSalary(partTime)).toMatchObject({
      salary: 10, normalized: 20, compa: 1, penetration: 50, marketRatio: 1, position: 'Trong dải',
    });
    const rows = m09.sample.map(analyzeSalary);
    expect(rows.find((row) => row.id === 'NV07')).toMatchObject({ position: 'Trên max', penetration: expect.closeTo(110) });
    expect(summarizeSalary(rows)).toMatchObject({ eligible: 12, below: 1, above: 2, groupCompa: expect.closeTo(351 / 348, 6) });
  });

  it('loại cả lương và midpoint của hồ sơ thiếu dữ liệu khỏi tổng nhóm', () => {
    const rows = m09.sample.filter((row) => row.grade === 'G1')
      .map((row) => analyzeSalary(row.id === 'NV04' ? { ...row, midpoint: 0 } : row));
    const summary = summarizeSalary(rows);
    expect(summary.eligible).toBe(3);
    expect(summary.groupCompa).toBeCloseTo(53 / 60);
  });

  it('không tính chỉ số khi thiếu FTE hoặc khi bộ lọc không có hồ sơ', () => {
    expect(analyzeSalary({ ...partTime, fte: 0 })).toMatchObject({ normalized: null, compa: null, position: 'Kiểm tra dữ liệu' });
    expect(summarizeSalary([])).toMatchObject({ eligible: 0, groupCompa: null, averageCompa: null });
  });
});
