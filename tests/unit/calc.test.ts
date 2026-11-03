import { describe, expect, it } from 'vitest';
import { seeded } from '../../src/core/rng';
import { isCorrect } from '../../src/core/num';
import { CALC, PIT_2026, progressiveTax, type CalcProblem } from '../../src/modules/tr/calc';

/** Tính lại đáp số độc lập từ số liệu đã sinh (công thức như bản cũ). */
type V = Record<string, number>;
const n = (p: CalcProblem) => p.v as V;
const arr = (p: CalcProblem, k: string) => p.v[k] as number[];
const EXPECT: Record<string, (p: CalcProblem) => number> = {
  'C-mid': (p) => (n(p).min! + n(p).max!) / 2 / 1e6,
  'C-spread': (p) => ((n(p).max! - n(p).min!) / n(p).min!) * 100,
  'C-minmid': (p) => n(p).mid! / (1 + n(p).s! / 2) / 1e6,
  'C-overlap': ({ v }) => (((v.x1 as number) - (v.m2 as number)) / ((v.x2 as number) - (v.m2 as number))) * 100,
  'C-mdiff': (p) => ((n(p).m2! - n(p).m1!) / n(p).m1!) * 100,
  'C-cr': (p) => n(p).sal! / n(p).mid!,
  'C-pen': (p) => ((n(p).sal! - n(p).min!) / (n(p).max! - n(p).min!)) * 100,
  'C-mi': (p) => (n(p).sal! / n(p).mk!) * 100,
  'C-pct': (p) => {
    // Nội suy tuyến tính kiểu Excel PERCENTILE.INC
    const xs = arr(p, 'vals'), h = (n(p).p! / 100) * (xs.length - 1);
    const lo = Math.floor(h);
    return (xs[lo]! + ((xs[lo + 1] ?? xs[lo]!) - xs[lo]!) * (h - lo)) / 1e6;
  },
  'C-bonus': (p) => {
    const w = arr(p, 'w'), k = arr(p, 'k');
    return (w.reduce((s, x, i) => s + x * k[i]!, 0) * n(p).sal! * n(p).tm!) / 1e6;
  },
  'C-sales': (p) => (n(p).ti! * (1 + ((n(p).att! - 100) / 100) * n(p).acc!)) / 1e6,
  'C-icr': (p) => (n(p).ti! / n(p).quota!) * 100,
  'C-cell': (p) => n(p).P! * n(p).C! * n(p).G!,
  'C-mean': (p) => arr(p, 'dist').reduce((s, x, i) => s + (5 - i) * x, 0) / 100,
  'C-meritmid': (p) => (((n(p).mid! * n(p).p!) / 100) / n(p).sal!) * 100,
  'C-aging': (p) => (n(p).base! * (1 + n(p).g! / 1200) ** n(p).m!) / 1e6,
  'C-comp': (p) => {
    const { b, t13, al, sti, which } = n(p) as Required<V>;
    return (12 * b! + t13! * b! + 12 * al! + (which === 3 ? sti! : 0)) / 1e6;
  },
  'C-pit': (p) => {
    const { g, dep } = n(p) as Required<V>;
    return Math.round(progressiveTax(Math.max(0, g! * 0.895 - 15_500_000 - dep! * 6_200_000)));
  },
  'C-ins': (p) => (n(p).g! * 0.215) / 1e6,
};

describe('19 bài tính', () => {
  it('đủ 19 bài, id không trùng, mỗi bài có cách kiểm', () => {
    expect(CALC).toHaveLength(19);
    expect(new Set(CALC.map((c) => c.id)).size).toBe(19);
    expect(Object.keys(EXPECT).sort()).toEqual(CALC.map((c) => c.id).sort());
  });

  for (const c of CALC) {
    it(`${c.id} · ${c.name}: đáp số khớp số liệu sinh ra (200 lần)`, () => {
      const r = seeded(c.id.length * 7919);
      for (let k = 0; k < 200; k++) {
        const p = c.gen(r);
        const want = EXPECT[c.id]!(p);
        expect(Number.isFinite(p.ans)).toBe(true);
        expect(Math.abs(p.ans - want)).toBeLessThanOrEqual(c.id === 'C-pit' ? 0.5 : 1e-9 * Math.max(1, Math.abs(want)));
        // Gõ đáp số làm tròn theo yêu cầu (kiểu VN, dấu phẩy) phải được chấm đúng.
        const typed = p.ans.toLocaleString('vi-VN', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec, useGrouping: false });
        expect(isCorrect(typed, p.ans, p.tol)).toBe(true);
        expect(p.q.length).toBeGreaterThan(10);
        expect(p.sol.length).toBeGreaterThan(10);
      }
    });
  }

  it('số liệu pháp lý 2026 giữ đúng', () => {
    expect(PIT_2026.personal).toBe(15_500_000);
    expect(PIT_2026.dependant).toBe(6_200_000);
    expect(PIT_2026.employeeIns).toBe(0.105);
    expect(PIT_2026.employerIns).toBe(0.215);
    expect(PIT_2026.brackets.map(([cap, r]) => [cap, r])).toEqual([
      [10e6, 0.05], [30e6, 0.1], [60e6, 0.2], [100e6, 0.3], [Infinity, 0.35],
    ]);
  });

  it('thuế lũy tiến từng phần: ví dụ tay', () => {
    expect(progressiveTax(0)).toBe(0);
    expect(progressiveTax(10e6)).toBe(500_000);
    expect(progressiveTax(30e6)).toBe(500_000 + 2_000_000);
    // 40tr: 0,5 + 2 + 10×20% = 4,5tr
    expect(progressiveTax(40e6)).toBe(4_500_000);
    expect(progressiveTax(120e6)).toBe(500_000 + 2_000_000 + 6_000_000 + 12_000_000 + 7_000_000);
  });
});
