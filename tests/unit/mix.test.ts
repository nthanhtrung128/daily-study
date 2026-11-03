import { describe, expect, it } from 'vitest';
import type { LeitnerState } from '../../src/core/leitner';
import { longestRun, planMix, tierOf, type LaneSpec } from '../../src/core/mix';
import { seeded } from '../../src/core/rng';

const T = '2026-11-03';
type It = { id: string; type: string };
const mk = (prefix: string, type: string, n: number): It[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}:${type}:${i}`, type }));

const TR: LaneSpec<It> = {
  items: [...mk('tr', 'flash', 60), ...mk('tr', 'quiz', 60), ...mk('tr', 'calc', 10)],
  weights: { flash: 0.4, quiz: 0.4, calc: 0.2 },
  time: { flash: 25, quiz: 40, calc: 90 },
};
const EN: LaneSpec<It> = {
  items: [...mk('en', 'phrase', 80), ...mk('en', 'pattern', 40)],
  weights: { phrase: 0.6, pattern: 0.4 },
  time: { phrase: 30, pattern: 75 },
};
const none = () => undefined;
const idOf = (e: { item: It | string }): string => (typeof e.item === 'string' ? e.item : e.item.id);
const due: LeitnerState = { box: 2, due: T, wrong: 0, last: 0 };
const dueWrong: LeitnerState = { box: 1, due: T, wrong: 2, last: 0 };
const weak: LeitnerState = { box: 2, due: '2026-11-09', wrong: 1, last: 0 };
const known: LeitnerState = { box: 4, due: '2026-12-01', wrong: 0, last: 0 };

const laneSecs = (p: ReturnType<typeof planMix<It, It, string>>) => {
  const s = { tr: 0, en: 0 };
  for (const e of p.entries) s[e.lane] += e.secs;
  return s;
};

describe('planMix – phiên trộn TR + EN', () => {
  it('bậc ưu tiên của mục', () => {
    expect(tierOf(dueWrong, T)).toBe('due');
    expect(tierOf(due, T)).toBe('due');
    expect(tierOf(weak, T)).toBe('wrong');
    expect(tierOf(undefined, T)).toBe('new');
    expect(tierOf(known, T)).toBeNull();
  });

  it.each([10, 15, 20, 30])('thời lượng %i phút: vừa ngân sách (vượt tối đa 1 mục), tỉ lệ thời gian TR 40%% / EN 60%%', (min) => {
    const p = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: min * 60, rng: seeded(min) });
    const s = laneSecs(p);
    expect(p.total).toBe(s.tr + s.en);
    expect(p.total).toBeGreaterThanOrEqual(min * 60);
    expect(p.total).toBeLessThan(min * 60 + 90);
    const share = s.tr / p.total;
    expect(Math.abs(share - 0.4)).toBeLessThan(min <= 10 ? 0.12 : 0.08);
  });

  it('tỉ lệ đổi theo cài đặt: TR 70% và 0% / 100%', () => {
    const p = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 1200, trShare: 0.7, rng: seeded(3) });
    const s = laneSecs(p);
    expect(Math.abs(s.tr / p.total - 0.7)).toBeLessThan(0.08);
    const allEn = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 600, trShare: 0, rng: seeded(3) });
    expect(allEn.entries.every((e) => e.lane === 'en')).toBe(true);
    const allTr = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 600, trShare: 1, rng: seeded(3) });
    expect(allTr.entries.every((e) => e.lane === 'tr')).toBe(true);
  });

  it('xen kẽ: không quá 3 mục liên tiếp cùng làn, và có cả hai làn ngay trong 4 mục đầu', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 1200, rng: seeded(seed) });
      const lanes = p.entries.map((e) => e.lane);
      expect(longestRun(lanes)).toBeLessThanOrEqual(3);
      expect(new Set(lanes.slice(0, 4)).size).toBe(2);
    }
  });

  it('trong làn: trộn loại theo tỉ lệ (có cả thẻ, trắc nghiệm, bài tính; cụm từ nhiều hơn câu mẫu)', () => {
    const p = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 1800, rng: seeded(9) });
    const c = (t: string) => p.entries.filter((e) => e.tier !== 'extra' && e.item.type === t).length;
    expect(c('flash')).toBeGreaterThan(0);
    expect(c('quiz')).toBeGreaterThan(0);
    expect(c('calc')).toBeGreaterThan(0);
    expect(c('phrase')).toBeGreaterThan(c('pattern'));
  });

  it('ưu tiên: đến hạn (từng sai trước) → từng sai hộp thấp → mới; bỏ mục đã học chưa đến hạn', () => {
    const st = new Map<string, LeitnerState>();
    st.set('tr:flash:5', due);
    st.set('tr:quiz:7', dueWrong);
    st.set('tr:flash:9', weak);
    st.set('en:phrase:3', due);
    st.set('en:phrase:4', weak);
    for (let i = 10; i < 60; i++) st.set(`tr:flash:${i}`, known);
    const p = planMix<It, It, string>({ tr: TR, en: EN, stateOf: (id) => st.get(id), today: T, budget: 600, rng: seeded(4) });
    const tr = p.entries.filter((e) => e.lane === 'tr').map((e) => idOf(e));
    const en = p.entries.filter((e) => e.lane === 'en').map((e) => idOf(e));
    expect(tr.slice(0, 3)).toEqual(['tr:quiz:7', 'tr:flash:5', 'tr:flash:9']);
    expect(en.slice(0, 2)).toEqual(['en:phrase:3', 'en:phrase:4']);
    const tiers = p.entries.filter((e) => e.lane === 'tr').map((e) => e.tier);
    expect(tiers.slice(0, 3)).toEqual(['due', 'due', 'wrong']);
    expect(tiers.slice(3).every((t) => t === 'new')).toBe(true);
    expect(tr.some((id) => st.get(id) === known)).toBe(false);
  });

  it('giới hạn mục mới (chung hai làn); hết mục thì phiên ngắn lại', () => {
    const st = new Map<string, LeitnerState>([
      ['tr:flash:1', due],
      ['en:phrase:1', due],
    ]);
    const p = planMix<It, It, string>({ tr: TR, en: EN, stateOf: (id) => st.get(id), today: T, budget: 1800, maxNew: 5, rng: seeded(5) });
    expect(p.fresh).toBe(5);
    expect(p.entries.filter((e) => e.tier === 'new')).toHaveLength(5);
    expect(p.entries).toHaveLength(7);
    expect(p.total).toBeLessThan(1800);
    const zero = planMix<It, It, string>({ tr: TR, en: EN, stateOf: (id) => st.get(id), today: T, budget: 1800, maxNew: 0, rng: seeded(5) });
    expect(zero.entries.map((e) => idOf(e)).sort()).toEqual(['en:phrase:1', 'tr:flash:1']);
  });

  it('một làn cạn thì làn kia lấp phần thời gian còn lại', () => {
    const p = planMix<It, It, string>({ tr: { ...TR, items: TR.items.slice(0, 2) }, en: EN, stateOf: none, today: T, budget: 900, rng: seeded(6) });
    expect(p.entries.filter((e) => e.lane === 'tr')).toHaveLength(2);
    expect(p.total).toBeGreaterThanOrEqual(900);
  });

  it('mục luyện nói kèm theo: tính vào EN, chèn khoảng 2/3 phiên ngay sau một mục TR, chỉ một lần', () => {
    const p = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 900, extra: { item: 'topic', secs: 150 }, rng: seeded(7) });
    const k = p.entries.findIndex((e) => e.tier === 'extra');
    expect(p.entries.filter((e) => e.tier === 'extra')).toHaveLength(1);
    expect(k).toBeGreaterThan(p.entries.length / 3);
    expect(p.entries[k - 1]?.lane).toBe('tr');
    const s = laneSecs(p);
    expect(s.en).toBe(p.secs.en);
    expect(Math.abs(s.tr / p.total - 0.4)).toBeLessThan(0.1);
    // Chuỗi cùng làn (bài nói tính EN) vẫn ≤ 3 với nhiều seed.
    for (let seed = 1; seed <= 40; seed++) {
      const q = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 600, extra: { item: 'say', secs: 60 }, rng: seeded(seed) });
      expect(longestRun(q.entries.map((e) => e.lane))).toBeLessThanOrEqual(3);
    }
    // Không vừa ngân sách → bỏ.
    const short = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 120, extra: { item: 'topic', secs: 150 }, rng: seeded(7) });
    expect(short.entries.some((e) => e.tier === 'extra')).toBe(false);
  });

  it('seed ngẫu nhiên ổn định: cùng seed → cùng phiên; khác seed → khác thứ tự', () => {
    const run = (seed: number) =>
      planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 900, rng: seeded(seed) }).entries.map((e) => idOf(e));
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it('không có mục nào → phiên rỗng', () => {
    const p = planMix<It, It, string>({ tr: { ...TR, items: [] }, en: { ...EN, items: [] }, stateOf: none, today: T, budget: 600 });
    expect(p.entries).toEqual([]);
    expect(p.total).toBe(0);
  });

  it('longestRun', () => {
    expect(longestRun([])).toBe(0);
    expect(longestRun(['tr', 'en', 'en', 'en', 'tr'])).toBe(3);
  });
});
