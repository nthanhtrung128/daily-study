import { describe, expect, it } from 'vitest';
import type { LeitnerState } from '../../src/core/leitner';
import { longestRun } from '../../src/core/mix';
import { DEFAULT_DAILY, normalizePrefs, shareLabel } from '../../src/core/prefs';
import { seeded } from '../../src/core/rng';
import { SAY_FROM_MIN, TOPIC_FROM_MIN, planDaily, summarize } from '../../src/modules/mix/plan';

const T = '2026-11-03';
const none = () => undefined;

describe('planDaily – dữ liệu thật', () => {
  it('mặc định 15 phút: TR + EN xen kẽ, kèm 1 đề nói, tỉ lệ thời gian ≈ 40/60', () => {
    const p = planDaily(DEFAULT_DAILY, none, T, { rng: seeded(1) });
    const s = summarize(p);
    expect(s.tr).toBeGreaterThan(3);
    expect(s.en).toBeGreaterThan(3);
    expect(s.speak).toBe('topic');
    expect(longestRun(p.entries.map((e) => e.lane))).toBeLessThanOrEqual(3);
    expect(Math.abs(p.secs.tr / p.total - 0.4)).toBeLessThan(0.1);
    expect(p.total).toBeGreaterThanOrEqual(15 * 60);
    // Làn TR chỉ lấy các loại của cách ôn "Hỗn hợp" (không có thuật ngữ).
    expect(p.entries.some((e) => e.lane === 'tr' && e.item.type === 'term')).toBe(false);
  });

  it('chọn bài nói theo thời lượng; tắt luyện nói thì không kèm', () => {
    expect(summarize(planDaily({ ...DEFAULT_DAILY, min: TOPIC_FROM_MIN }, none, T, { rng: seeded(2) })).speak).toBe('topic');
    expect(summarize(planDaily({ ...DEFAULT_DAILY, min: SAY_FROM_MIN }, none, T, { rng: seeded(2) })).speak).toBe('say');
    expect(summarize(planDaily({ ...DEFAULT_DAILY, min: 5 }, none, T, { rng: seeded(2) })).speak).toBeNull();
    expect(summarize(planDaily({ ...DEFAULT_DAILY, speak: false }, none, T, { rng: seeded(2) })).speak).toBeNull();
    expect(summarize(planDaily({ ...DEFAULT_DAILY, trShare: 1 }, none, T, { rng: seeded(2) })).speak).toBeNull();
  });

  it('hạn mức mục mới trừ số mục mới đã học hôm nay', () => {
    const p = planDaily({ ...DEFAULT_DAILY, maxNew: 10 }, none, T, { newToday: 7, rng: seeded(3) });
    expect(p.fresh).toBe(3);
    expect(p.entries.filter((e) => e.tier !== 'extra')).toHaveLength(3);
    const q = planDaily({ ...DEFAULT_DAILY, maxNew: 10 }, none, T, { newToday: 12, rng: seeded(3) });
    expect(q.fresh).toBe(0);
  });

  it('mục đến hạn của cả hai làn được lấy trước mục mới', () => {
    const st = new Map<string, LeitnerState>([
      ['tr:Q001', { box: 1, due: T, wrong: 1, last: 0 }],
      ['en:ph-0001', { box: 2, due: '2026-11-01', wrong: 0, last: 0 }],
    ]);
    const p = planDaily(DEFAULT_DAILY, (id) => st.get(id), T, { rng: seeded(4) });
    expect(p.entries.find((e) => e.lane === 'tr')?.item.id).toBe('tr:Q001');
    expect(p.entries.find((e) => e.lane === 'en' && e.tier !== 'extra')?.item.id).toBe('en:ph-0001');
  });

  it('cùng seed → cùng phiên', () => {
    const ids = (seed: number) => planDaily(DEFAULT_DAILY, none, T, { rng: seeded(seed) }).entries.map((e) => e.item.id);
    expect(ids(7)).toEqual(ids(7));
  });

  it('ghi đè thời lượng (ôn thêm 5 phút)', () => {
    const p = planDaily(DEFAULT_DAILY, none, T, { minutes: 5, rng: seeded(5) });
    expect(p.total).toBeGreaterThanOrEqual(300);
    expect(p.total).toBeLessThan(300 + 90);
  });
});

describe('cài đặt phiên hằng ngày', () => {
  it('chuẩn hóa: giữ giá trị hợp lệ, sửa giá trị hỏng', () => {
    expect(normalizePrefs(undefined)).toEqual(DEFAULT_DAILY);
    expect(normalizePrefs({ min: 20, trShare: 0.33, maxNew: 5, speak: false, remindAt: '07:05', remindDays: [0, 1, 1, 6, 9] })).toEqual({
      min: 20,
      trShare: 0.35,
      maxNew: 5,
      speak: false,
      remindAt: '07:05',
      remindDays: [1, 6, 0],
      goalMin: 15,
      restDays: [],
    });
    expect(normalizePrefs({ min: 'x', trShare: 7, maxNew: -3, speak: 1, remindAt: '25:00', remindDays: 'mon' })).toEqual({
      ...DEFAULT_DAILY,
      trShare: 1,
      maxNew: 0,
    });
  });

  it('nhãn tỉ lệ', () => {
    expect(shareLabel(0.4)).toBe('TR 40% · Tiếng Anh 60%');
    expect(shareLabel(1)).toBe('TR 100% · Tiếng Anh 0%');
  });
});
