import { describe, expect, it } from 'vitest';
import { balanceMerit } from '../../src/modules/tr/merit';
import m06 from '../../content/tr-roadmap/m06.json';

describe('cân ma trận merit', () => {
  it('cân cả ma trận theo chi phí có trọng số', () => {
    const result = balanceMerit(m06.merit.cells, 5);
    expect(result.payroll).toBe(1000);
    expect(result.original).toBeCloseTo(51.2);
    expect(result.factor).toBeCloseTo(0.9765625);
    expect(result.rows[0]?.rate).toBeCloseTo(8.789);
    expect(result.rows.reduce((sum, row) => sum + row.increase, 0)).toBeCloseTo(50);
  });

  it('phân biệt không có tiền tăng gốc và không cần phân bổ', () => {
    const cells = [{ payroll: 120, rate: 0 }];
    expect(balanceMerit(cells, 5)).toMatchObject({ factor: null, rows: [] });
    expect(balanceMerit(cells, 0)).toMatchObject({ factor: 0, rows: [{ rate: 0, increase: 0 }] });
  });
});
