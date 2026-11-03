import { describe, expect, it } from 'vitest';
import type { LeitnerState } from '../../src/core/leitner';
import { baiRows, extraRows, hardest, heatCells, heatLevel, learnedCount, totals } from '../../src/modules/progress/stats';
import { ITEMS } from '../../src/modules/tr/items';

const st = (box: number, wrong = 0, last = 0): LeitnerState => ({ box, due: '2026-11-03', wrong, last });

describe('số liệu Tiến độ', () => {
  it('thanh theo buổi: đã thuộc / đang học, bỏ thuật ngữ và bài tính', () => {
    const b1 = ITEMS.filter((i) => i.bai.includes('1') && i.type !== 'term' && i.type !== 'calc');
    const map = new Map<string, LeitnerState>([
      [b1[0]!.id, st(4)],
      [b1[1]!.id, st(2)],
      ['tr:C-mid', st(5)],
    ]);
    const rows = baiRows((id) => map.get(id));
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ key: '1', n: b1.length, l1: 1, l2: 1 });
    expect(rows.reduce((s, r) => s + r.l2, 0)).toBe(1);
    const ex = extraRows((id) => (id === 'en:ph-0001' ? st(5) : undefined));
    expect(ex.map((r) => r.key)).toEqual(['term', 'phrase', 'pattern']);
    expect(ex[1]).toMatchObject({ l2: 1, l1: 0 });
    expect(ex[1]!.n).toBeGreaterThanOrEqual(300);
  });

  it('bản đồ nhiệt 35 ngày, mức như bản cũ', () => {
    const days: Record<string, number> = { '2026-11-03': 31, '2026-11-02': 12, '2026-10-01': 1, '2026-09-28': 5 };
    const cells = heatCells((d) => days[d] ?? 0, '2026-11-03');
    expect(cells).toHaveLength(35);
    expect(cells[34]).toEqual({ day: '2026-11-03', n: 31, lv: 3 });
    expect(cells[33]?.lv).toBe(2);
    expect(cells[0]?.day).toBe('2026-09-30');
    expect(cells.find((c) => c.day === '2026-10-01')?.lv).toBe(1);
    expect([0, 1, 11, 12, 29, 30].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it('tổng lượt, đã thuộc, hay sai', () => {
    expect(totals([{ day: 'a', n: 3, ok: 1, s: 60 }, { day: 'b', n: 0, ok: 0, s: 0 }])).toEqual({ n: 3, s: 60, active: 1 });
    const entries: [string, LeitnerState][] = [
      ['tr:K001', st(4)],
      ['tr:Q001', st(1, 3, 1)],
      ['tr:Q002', st(1, 3, 9)],
      ['tr:Q003', st(2, 1)],
      ['tr:GONE', st(1, 9)],
    ];
    expect(learnedCount(entries)).toBe(1);
    const h = hardest(entries, (id) => id !== 'tr:GONE');
    expect(h.map(([id]) => id)).toEqual(['tr:Q002', 'tr:Q001', 'tr:Q003']);
  });
});
