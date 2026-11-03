import { describe, expect, it } from 'vitest';
import type { LeitnerState } from '../../src/core/leitner';
import { seeded } from '../../src/core/rng';
import { EN_ITEMS, PHRASES } from '../../src/modules/english/content';
import { cardDir, dueEnglish, enStats, planEnglish } from '../../src/modules/english/plan';

const today = '2026-11-03';
const st = (m: Record<string, LeitnerState>) => (id: string) => m[id];

describe('ngân hàng mục tiếng Anh', () => {
  it('id có tiền tố en: theo id nội dung (en:ph-0001, en:pt-0001), không trùng', () => {
    expect(EN_ITEMS.find((i) => i.type === 'phrase')?.id).toBe('en:ph-0001');
    expect(EN_ITEMS.find((i) => i.type === 'pattern')?.id).toBe('en:pt-0001');
    expect(new Set(EN_ITEMS.map((i) => i.id)).size).toBe(EN_ITEMS.length);
    expect(EN_ITEMS.every((i) => /^en:(ph|pt)-\d{4}$/.test(i.id))).toBe(true);
  });
});

describe('danh sách thẻ đến hạn EN', () => {
  const states = st({
    'en:ph-0005': { box: 2, due: '2026-11-01', wrong: 0, last: 1 },
    'en:ph-0009': { box: 1, due: today, wrong: 2, last: 1 },
    'en:ph-0010': { box: 3, due: '2026-11-10', wrong: 0, last: 1 }, // chưa đến hạn
    'en:pt-0002': { box: 1, due: '2026-11-02', wrong: 0, last: 1 },
    'tr:K001': { box: 1, due: today, wrong: 0, last: 1 }, // mục TR không tính
  });

  it('chỉ lấy mục EN đã học có due ≤ hôm nay, từng quên lên trước', () => {
    expect(dueEnglish(states, today).map((i) => i.id)).toEqual(['en:ph-0009', 'en:ph-0005', 'en:pt-0002']);
    expect(dueEnglish(states, today, 'pattern').map((i) => i.id)).toEqual(['en:pt-0002']);
  });

  it('thống kê: đến hạn, đã thuộc, mới', () => {
    const s = enStats(states, today, 'phrase');
    expect(s).toMatchObject({ total: PHRASES.length, due: 2, learned: 0, fresh: PHRASES.length - 3 });
  });

  it('lập phiên: thẻ đến hạn trước mục mới, bỏ mục đã học chưa đến hạn, chỉ đúng loại', () => {
    const list = planEnglish('phrase', states, today, { minutes: 5, dry: true, rng: seeded(1) });
    expect(list.length).toBe(10); // 5 phút / 30 giây
    expect(list.slice(0, 2).map((i) => i.id)).toEqual(['en:ph-0009', 'en:ph-0005']);
    expect(list.every((i) => i.type === 'phrase')).toBe(true);
    expect(list.map((i) => i.id)).not.toContain('en:ph-0010');
  });

  it('lọc theo chủ đề', () => {
    const list = planEnglish('pattern', st({}), today, { minutes: 15, topics: ['interview'], rng: seeded(2) });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => i.type === 'pattern' && i.pt.topic === 'interview')).toBe(true);
  });

  it('hết mục (đã thuộc hết, chưa đến hạn) → phiên rỗng', () => {
    const all: Record<string, LeitnerState> = {};
    for (const i of EN_ITEMS) all[i.id] = { box: 4, due: '2026-12-01', wrong: 0, last: 1 };
    expect(planEnglish('phrase', st(all), today, { minutes: 10 })).toEqual([]);
  });
});

describe('chiều thẻ từ', () => {
  it('mục mới luôn EN → VI; mục đã học có cả hai chiều', () => {
    expect(cardDir(undefined)).toBe('en-vi');
    const rng = seeded(7);
    const dirs = new Set(Array.from({ length: 40 }, () => cardDir({ box: 3, due: today, wrong: 0, last: 1 }, rng)));
    expect(dirs).toEqual(new Set(['en-vi', 'vi-en']));
  });
});
