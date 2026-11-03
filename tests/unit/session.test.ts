import { describe, expect, it } from 'vitest';
import type { LeitnerState } from '../../src/core/leitner';
import { seeded } from '../../src/core/rng';
import { buildSession, priority } from '../../src/core/session';
import { ITEMS } from '../../src/modules/tr/items';
import { DEFAULT_PREFS, TIME, homeStats, planSession, type Prefs } from '../../src/modules/tr/plan';

const T = '2026-11-03';
const none = () => undefined;
const total = (list: { type: keyof typeof TIME }[]) => list.reduce((s, i) => s + TIME[i.type], 0);

describe('ngân hàng mục TR', () => {
  it('đủ loại mục từ data.json + 19 bài tính', () => {
    const c = (t: string) => ITEMS.filter((i) => i.type === t).length;
    expect(c('flash')).toBe(162);
    expect(c('quiz')).toBe(121);
    expect(c('open')).toBe(100);
    expect(c('formula')).toBe(19);
    expect(c('calc')).toBe(19);
    expect(c('term')).toBeGreaterThan(200);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });
});

describe('lập phiên ôn', () => {
  it('ưu tiên: đến hạn & từng sai > từng sai hộp thấp > mới > đã học chưa đến hạn', () => {
    const r = seeded(1);
    const due: LeitnerState = { box: 2, due: T, wrong: 1, last: 0 };
    const weak: LeitnerState = { box: 2, due: '2026-11-10', wrong: 1, last: 0 };
    const known: LeitnerState = { box: 5, due: '2026-12-01', wrong: 0, last: 0 };
    expect(priority(due, T, r)).toBeGreaterThanOrEqual(4);
    expect(priority(weak, T, r)).toBeGreaterThanOrEqual(2);
    expect(priority(undefined, T, r)).toBeGreaterThanOrEqual(1);
    expect(priority(known, T, r)).toBeLessThan(1);
  });

  it('vừa ngân sách thời gian và trộn loại theo tỷ lệ (hỗn hợp 10 phút)', () => {
    const list = planSession(DEFAULT_PREFS, none, T, { dry: true, rng: seeded(2) });
    const t = total(list);
    expect(t).toBeGreaterThanOrEqual(600);
    expect(t - TIME[list[list.length - 1]!.type]).toBeLessThan(600);
    const types = new Set(list.map((i) => i.type));
    for (const k of ['flash', 'formula', 'quiz', 'calc', 'open']) expect(types.has(k as never)).toBe(true);
    expect(types.has('term')).toBe(false);
  });

  it('mỗi thời lượng cho đúng ngân sách', () => {
    for (const min of [5, 15, 30]) {
      const list = planSession({ ...DEFAULT_PREFS, min, mode: 'quiz' }, none, T, { rng: seeded(min) });
      expect(list.every((i) => i.type === 'quiz')).toBe(true);
      expect(list.length).toBe(Math.ceil((min * 60) / TIME.quiz));
    }
  });

  it('bài tính xoay vòng không cạn', () => {
    const list = planSession({ ...DEFAULT_PREFS, min: 30, mode: 'calc' }, none, T, { dry: true, rng: seeded(3) });
    expect(list.length).toBe(20);
    expect(new Set(list.map((i) => i.id)).size).toBe(19);
  });

  it('lọc theo buổi học (thuật ngữ luôn trong phạm vi)', () => {
    const prefs: Prefs = { min: 30, mode: 'flash', bai: ['2'] };
    const list = planSession(prefs, none, T, { rng: seeded(4) });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => i.bai.includes('2'))).toBe(true);
  });

  it('chế độ chỉ ôn đến hạn & câu sai: không thêm mục mới', () => {
    const states = new Map<string, LeitnerState>([
      ['tr:Q001', { box: 1, due: T, wrong: 1, last: 0 }],
      ['tr:K001', { box: 3, due: '2026-11-02', wrong: 0, last: 0 }],
      ['tr:K002', { box: 5, due: '2026-12-30', wrong: 0, last: 0 }],
    ]);
    const list = planSession({ ...DEFAULT_PREFS, mode: 'review' }, (id) => states.get(id), T, { rng: seeded(5) });
    expect(list.map((i) => i.id).sort()).toEqual(['tr:K001', 'tr:Q001']);
  });

  it('hỗn hợp: đặt mục đến hạn lên trước, bỏ mục đã thuộc chưa đến hạn', () => {
    const states = new Map<string, LeitnerState>([
      ['tr:K005', { box: 3, due: T, wrong: 0, last: 0 }],
      ['tr:K001', { box: 5, due: '2026-12-30', wrong: 0, last: 0 }],
    ]);
    const list = planSession(DEFAULT_PREFS, (id) => states.get(id), T, { dry: true, rng: seeded(6) });
    expect(list.find((i) => i.type === 'flash')?.id).toBe('tr:K005');
    expect(list.some((i) => i.id === 'tr:K001')).toBe(false);
  });

  it('không có mục → phiên rỗng', () => {
    expect(buildSession({ items: [], stateOf: none, today: T, budget: 600, weights: { a: 1 }, time: {} })).toEqual([]);
  });

  it('số liệu trang chủ', () => {
    const states = new Map<string, LeitnerState>([
      ['tr:Q001', { box: 1, due: T, wrong: 1, last: 0 }],
      ['tr:K001', { box: 5, due: '2026-12-30', wrong: 0, last: 0 }],
    ]);
    const s = homeStats((id) => states.get(id), T);
    expect(s).toMatchObject({ due: 1, wrong: 1, learned: 1 });
    expect(s.pen).toBeCloseTo(6 / 5 / s.tracked, 6);
  });
});
