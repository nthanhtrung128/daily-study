import { afterEach, describe, expect, it } from 'vitest';
import { applyBackup, exportBackup, parseBackup } from '../../src/core/backup';
import { StudyDB, getSetting, setSetting } from '../../src/core/db';
import { applyGrade, type LeitnerState } from '../../src/core/leitner';
import { MISS_KEY, MissStore, applyMarks, mergeMiss, normalizeMiss, pickSentences, topMissed, type MissMap } from '../../src/core/misswords';
import { planMix, type LaneSpec } from '../../src/core/mix';
import { DEFAULT_DAILY, normalizePrefs } from '../../src/core/prefs';
import { ACTIVE_KEY, loadActive, saveActive, type ActiveSession } from '../../src/core/resume';
import { seeded } from '../../src/core/rng';
import { RECENT_MS, WEAK_MIN, rankWeak, weakness } from '../../src/core/weak';
import { EN_ITEMS } from '../../src/modules/english/content';
import { DICT_ITEMS } from '../../src/modules/english/dictation';
import { scoreSpeech } from '../../src/modules/english/speech/score';
import { DICT_SECS, planDaily, summarize } from '../../src/modules/mix/plan';
import { tally } from '../../src/modules/mix/result';
import { WEAK_MAX_ITEMS, planWeak } from '../../src/modules/mix/weak';
import { ITEMS } from '../../src/modules/tr/items';
import { resolveActive } from '../../src/ui/mix/resumeTarget';

const NOW = 1_800_000_000_000;
const T = '2027-01-15';
const st = (box: number, wrong: number, last = 0): LeitnerState => ({ box, due: T, wrong, last });

describe('độ yếu của mục', () => {
  it('công thức: wrong × (4 − hộp)/3 + 2 nếu hộp 1 và vừa ôn ≤ 3 ngày', () => {
    expect(weakness(undefined, NOW)).toBe(0);
    expect(weakness(st(1, 0, NOW), NOW)).toBe(0);
    expect(weakness(st(1, 1, NOW - 1000), NOW)).toBe(3);
    expect(weakness(st(1, 1, NOW - RECENT_MS - 1), NOW)).toBe(1);
    expect(weakness(st(1, 2), NOW)).toBe(2);
    expect(weakness(st(2, 3), NOW)).toBe(2);
    expect(weakness(st(3, 6), NOW)).toBe(2);
    expect(weakness(st(4, 9, NOW), NOW)).toBe(0);
  });

  it('chấm đúng thì độ yếu giảm, chấm quên thì tăng', () => {
    const forgot = applyGrade(st(3, 1), 0, T, NOW);
    expect(weakness(forgot, NOW)).toBeGreaterThanOrEqual(WEAK_MIN);
    const ok = applyGrade(forgot, 2, T, NOW);
    expect(weakness(ok, NOW)).toBeLessThan(weakness(forgot, NOW));
    expect(weakness(applyGrade(applyGrade(ok, 2, T, NOW), 2, T, NOW), NOW)).toBe(0);
  });

  it('thứ tự chọn: yếu nhất trước, bỏ mục dưới ngưỡng, giới hạn số mục', () => {
    const states: Record<string, LeitnerState> = {
      a: st(1, 1, NOW - 1000), // 3
      b: st(1, 5), // 5
      c: st(2, 1), // 0,67 → không yếu
      d: st(1, 3, NOW - 500), // 5 (ôn gần hơn b)
      e: st(5, 7), // đã thuộc
    };
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
    expect(rankWeak(items, (id) => states[id], NOW).map((x) => x.id)).toEqual(['d', 'b', 'a']);
    expect(rankWeak(items, (id) => states[id], NOW, 2).map((x) => x.id)).toEqual(['d', 'b']);
  });
});

describe('từ hay sai', () => {
  it('ghi theo từ: sai / thiếu +1, đúng −1, bỏ từ chức năng', () => {
    const r = scoreSpeech('Please review the salary proposal today.', 'please review salary proposed');
    let m = applyMarks({}, r.words, NOW);
    expect(m).toEqual({ proposal: { n: 1, at: NOW }, today: { n: 1, at: NOW } });
    m = applyMarks(m, r.words, NOW + 1);
    expect(topMissed(m)).toEqual([{ word: 'proposal', n: 2 }, { word: 'today', n: 2 }]);
    // Nói đúng cả câu: mọi từ giảm 1.
    m = applyMarks(m, scoreSpeech('Please review the salary proposal today.', 'please review the salary proposal today').words, NOW + 2);
    expect(m.proposal?.n).toBe(1);
    m = applyMarks(m, scoreSpeech('proposal today', 'proposal today').words, NOW + 3);
    expect(m).toEqual({});
  });

  it('top 10 xếp theo số lần sai, rồi lần sai gần nhất', () => {
    const m: MissMap = { budget: { n: 2, at: 1 }, salary: { n: 5, at: 1 }, bonus: { n: 2, at: 9 } };
    expect(topMissed(m, 2)).toEqual([
      { word: 'salary', n: 5 },
      { word: 'bonus', n: 2 },
    ]);
  });

  it('chọn câu chứa từ sai: câu phủ nhiều lần sai nhất trước, không lặp từ đã phủ', () => {
    const items = [
      { en: 'The budget is tight.' },
      { en: 'Our salary budget grew, and the bonus pool too.' },
      { en: 'Nothing related here.' },
      { en: 'Benefits matter.' },
    ];
    const m: MissMap = { budget: { n: 2, at: 1 }, salary: { n: 3, at: 1 }, benefits: { n: 1, at: 1 } };
    expect(pickSentences(m, items, 4).map((x) => x.en)).toEqual([items[1]!.en, items[3]!.en]);
    expect(pickSentences(m, items, 1)).toHaveLength(1);
    expect(pickSentences({}, items, 4)).toEqual([]);
  });

  it('chuẩn hóa dữ liệu hỏng; gộp lấy số lớn hơn', () => {
    expect(normalizeMiss({ 'Pay,': { n: 2, at: 5 }, x: { n: 0 }, y: 'bad', z: { n: 'a' } })).toEqual({ pay: { n: 2, at: 5 } });
    expect(normalizeMiss(null)).toEqual({});
    expect(mergeMiss({ a: { n: 1, at: 9 }, b: { n: 4, at: 1 } }, { a: { n: 3, at: 2 }, c: { n: 1, at: 1 } })).toEqual({
      a: { n: 3, at: 9 },
      b: { n: 4, at: 1 },
      c: { n: 1, at: 1 },
    });
  });
});

describe('lưu Dexie + sao lưu', () => {
  const dbs: StudyDB[] = [];
  const open = () => {
    const d = new StudyDB(`weak-${Math.random()}`);
    dbs.push(d);
    return d;
  };
  afterEach(async () => {
    await Promise.all(dbs.splice(0).map((d) => d.delete()));
  });

  it('MissStore ghi xuống settings, kể cả lượt ghi trước khi đọc xong', async () => {
    const d = open();
    await setSetting(MISS_KEY, { salary: { n: 2, at: 1 } }, d);
    const s = new MissStore(d);
    s.record([{ text: 'Salary', status: 'wrong' }], NOW);
    await Promise.all([s.load(), s.load()]);
    s.record([{ text: 'bonus.', status: 'missing' }], NOW);
    await s.flush();
    expect(s.get()).toEqual({ salary: { n: 3, at: NOW }, bonus: { n: 1, at: NOW } });
    expect(await getSetting(MISS_KEY, null, d)).toEqual(s.get());
  });

  it('sao lưu vòng tròn có từ hay sai + cài đặt nghe chép; gộp lấy số lớn hơn', async () => {
    const a = open();
    await setSetting(MISS_KEY, { salary: { n: 3, at: 5 }, bonus: { n: 1, at: 5 } }, a);
    await setSetting('daily.prefs', { ...DEFAULT_DAILY, dict: true }, a);
    const file = JSON.stringify(await exportBackup(a));
    const b = open();
    await applyBackup(parseBackup(file), 'replace', b);
    expect(await getSetting(MISS_KEY, null, b)).toEqual({ salary: { n: 3, at: 5 }, bonus: { n: 1, at: 5 } });
    expect(normalizePrefs(await getSetting('daily.prefs', null, b)).dict).toBe(true);
    const c = open();
    await setSetting(MISS_KEY, { salary: { n: 1, at: 9 }, equity: { n: 2, at: 9 } }, c);
    await applyBackup(parseBackup(file), 'merge', c);
    expect(await getSetting(MISS_KEY, null, c)).toEqual({ salary: { n: 3, at: 9 }, bonus: { n: 1, at: 5 }, equity: { n: 2, at: 9 } });
  });

  it('file sao lưu cũ (không có từ hay sai, cài đặt không có dict) vẫn nhập được', async () => {
    const old = {
      app: 'daily-study',
      format: 1,
      exportedAt: '2026-11-01T00:00:00.000Z',
      items: [{ id: 'tr:K001', box: 1, due: '2026-11-01', wrong: 2, last: 5 }],
      days: [{ day: '2026-11-01', n: 3, ok: 1, s: 60 }],
      notes: [],
      reviews: [],
      settings: [{ key: 'daily.prefs', value: { min: 20, trShare: 0.4, maxNew: 10, speak: true } }],
    };
    const d = open();
    await setSetting(MISS_KEY, { salary: { n: 1, at: 1 } }, d);
    await applyBackup(parseBackup(JSON.stringify(old)), 'merge', d);
    expect(await getSetting(MISS_KEY, null, d)).toEqual({ salary: { n: 1, at: 1 } });
    await applyBackup(parseBackup(JSON.stringify(old)), 'replace', d);
    expect(await d.items.count()).toBe(1);
    expect(await getSetting(MISS_KEY, null, d)).toBeNull();
    expect(normalizePrefs(await getSetting('daily.prefs', null, d))).toMatchObject({ min: 20, dict: false });
  });

  it('phiên dở kiểu weak / dict lưu và đọc lại được', async () => {
    const d = open();
    const s: ActiveSession = { kind: 'dict', items: [{ id: 'x' }], pos: 0, results: [], t0: NOW, minutes: 0, savedAt: NOW };
    await saveActive(s, d);
    expect((await loadActive(NOW + 1000, d))?.kind).toBe('dict');
    expect(await getSetting(ACTIVE_KEY, null, d)).toEqual(s);
  });
});

describe('phiên trộn có nghe chép', () => {
  type It = { id: string; type: string };
  const mk = (p: string, type: string, n: number): It[] => Array.from({ length: n }, (_, i) => ({ id: `${p}:${type}:${i}`, type }));
  const TR: LaneSpec<It> = { items: mk('tr', 'flash', 60), weights: { flash: 1 }, time: { flash: 25 } };
  const EN: LaneSpec<It> = { items: mk('en', 'phrase', 80), weights: { phrase: 1 }, time: { phrase: 30 } };
  const none = () => undefined;

  it('planMix: nhiều mục thêm tính vào thời gian EN, mỗi mục một chỗ', () => {
    const base = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 900, rng: seeded(3) });
    const p = planMix<It, It, string>({
      tr: TR,
      en: EN,
      stateOf: none,
      today: T,
      budget: 900,
      extra: { item: 'topic', secs: 150 },
      extras: [
        { item: 'd1', secs: 60, at: 1 / 3 },
        { item: 'd2', secs: 60, at: 0.9 },
      ],
      rng: seeded(3),
    });
    const pos = (x: string) => p.entries.findIndex((e) => e.item === x);
    expect(pos('d1')).toBeGreaterThan(0);
    expect(pos('d1')).toBeLessThan(pos('topic'));
    expect(pos('topic')).toBeLessThan(pos('d2'));
    // Thời gian EN gồm cả mục thêm, tỉ lệ TR/EN vẫn quanh 40/60 → ít thẻ EN hơn bản không có mục thêm.
    expect(p.secs.en / p.total).toBeGreaterThan(0.5);
    expect(p.secs.en / p.total).toBeLessThan(0.7);
    const cards = (q: typeof p) => q.entries.filter((e) => e.lane === 'en' && e.tier !== 'extra').length;
    expect(cards(p)).toBeLessThan(cards(base));
    // Không vừa ngân sách thì bỏ.
    const tiny = planMix<It, It, string>({ tr: TR, en: EN, stateOf: none, today: T, budget: 100, extras: [{ item: 'd1', secs: 60 }, { item: 'd2', secs: 60 }], rng: seeded(3) });
    expect(tiny.entries.filter((e) => e.tier === 'extra')).toHaveLength(1);
  });

  it('planDaily: tắt (mặc định) không có nghe chép; bật thì 1 câu, từ 15 phút 2 câu', () => {
    const dicts = (dict: boolean | undefined, min: number) => {
      const plan = planDaily({ ...DEFAULT_DAILY, min, speak: false, ...(dict === undefined ? {} : { dict }) }, none, T, { rng: seeded(5) });
      return { plan, list: plan.entries.flatMap((e) => (e.tier === 'extra' && e.item.kind === 'dict' ? [e.item] : [])) };
    };
    expect(DEFAULT_DAILY.dict).toBe(false);
    expect(dicts(undefined, 15).list).toHaveLength(0);
    expect(dicts(false, 15).list).toHaveLength(0);
    expect(dicts(true, 10).list).toHaveLength(1);
    const { plan, list } = dicts(true, 15);
    expect(list).toHaveLength(2);
    expect(summarize(plan).dict).toBe(2);
    // Câu có id Leitner; thẻ gốc không lặp lại trong làn EN.
    const ids = new Set(list.map((x) => x.item.id));
    expect([...ids].every((id) => id?.startsWith('en:'))).toBe(true);
    expect(plan.entries.some((e) => e.tier !== 'extra' && ids.has(e.item.id))).toBe(false);
    expect(plan.secs.en).toBeGreaterThanOrEqual(2 * DICT_SECS);
    const limited = planDaily({ ...DEFAULT_DAILY, dict: true, speak: false, maxNew: 5 }, none, T, { newToday: 4, rng: seeded(5) });
    expect(limited.fresh).toBe(1);
    expect(summarize(limited).dict).toBe(1);
    const exhausted = planDaily({ ...DEFAULT_DAILY, dict: true, speak: false, maxNew: 5 }, none, T, { newToday: 5, rng: seeded(5) });
    expect(exhausted.entries).toHaveLength(0);
    // Chỉ TR (tỉ lệ 100%) thì không chèn.
    expect(planDaily({ ...DEFAULT_DAILY, trShare: 1, dict: true }, none, T, { rng: seeded(5) }).entries.some((e) => e.tier === 'extra')).toBe(false);
  });

  it('kết quả: câu nghe chép tính vào hàng Tiếng Anh, không tính là bài nói', () => {
    const { entries } = planDaily({ ...DEFAULT_DAILY, speak: false, dict: true }, none, T, { rng: seeded(5) });
    const d = entries.filter((e) => e.tier === 'extra');
    const t = tally([
      { entry: d[0]!, g: 2, score: 95 },
      { entry: d[1]!, g: 0, score: 41 },
    ]);
    expect(t.en).toMatchObject({ n: 2, ok: 1, wrong: 1 });
    expect(t.speak.done).toBe(0);
    expect(t.dict).toEqual({ done: 2, score: 68 });
    expect(t.review).toHaveLength(1);
  });
});

describe('phiên Ôn điểm yếu', () => {
  const tr = ITEMS[0]!;
  const en = EN_ITEMS[0]!;
  const states: Record<string, LeitnerState> = { [tr.id]: st(1, 1, NOW - 1000), [en.id]: st(1, 4) };
  const stateOf = (id: string) => states[id];
  const word = 'compensation';
  const withWord = DICT_ITEMS.filter((d) => d.en.toLowerCase().split(/\W+/).includes(word));
  const miss: MissMap = { [word]: { n: 3, at: NOW } };

  it('rỗng khi chưa có điểm yếu', () => {
    expect(planWeak(() => undefined, NOW, {})).toEqual([]);
  });

  it('gồm mục TR + EN yếu (yếu nhất trước) và câu chứa từ hay sai', () => {
    expect(withWord.length).toBeGreaterThan(0);
    const list = planWeak(stateOf, NOW, miss);
    expect(list.slice(0, 2).map((e) => [e.lane, e.tier, e.item.id])).toEqual([
      ['en', 'wrong', en.id],
      ['tr', 'wrong', tr.id],
    ]);
    const s = list[2]!;
    expect(list).toHaveLength(3);
    expect(s.tier === 'extra' && s.item.kind === 'dict' && s.item.item.en.toLowerCase()).toContain(word);
    // Giới hạn số mục.
    const many = planWeak(() => st(1, 2), NOW, {});
    expect(many).toHaveLength(WEAK_MAX_ITEMS);
  });

  it('có nhận giọng: câu thứ hai là nói có chấm', () => {
    const m: MissMap = { ...miss, deadline: { n: 2, at: NOW }, budget: { n: 2, at: NOW }, feedback: { n: 1, at: NOW } };
    const kinds = planWeak(() => undefined, NOW, m, { canSpeak: true }).map((e) => (e.tier === 'extra' ? e.item.kind : 'card'));
    expect(kinds.length).toBeGreaterThanOrEqual(2);
    expect(kinds[0]).toBe('dict');
    expect(kinds[1]).toBe('say');
  });

  it('tiếp tục phiên dở: weak dựng lại đúng mục, vị trí, kết quả', () => {
    const list = planWeak(stateOf, NOW, miss);
    const saved: ActiveSession = {
      kind: 'weak',
      items: list.map((x) => ({ id: x.item.id, lane: x.lane, tier: x.tier, secs: x.secs })),
      pos: 1,
      results: [{ i: 0, g: 0 }],
      t0: NOW - 60_000,
      minutes: 3,
      savedAt: NOW,
    };
    const r = resolveActive(saved, NOW + 1000);
    expect(r).toMatchObject({ done: 1, total: 3 });
    const t = r!.target;
    if (t.kind !== 'mix') throw new Error('sai kiểu');
    expect(t.weak).toBe(true);
    expect(t.entries).toEqual(list);
    expect(t.results).toEqual([{ entry: list[0], g: 0 }]);
    // Phiên trộn thường không mang cờ weak.
    const m = resolveActive({ ...saved, kind: 'mix' }, NOW + 1000)!.target;
    expect(m.kind === 'mix' && m.weak).toBeFalsy();
  });

  it('tiếp tục phiên dở: nghe chép dựng lại câu theo khóa, giữ điểm đã chấm', () => {
    const items = DICT_ITEMS.slice(0, 4);
    const saved: ActiveSession = {
      kind: 'dict',
      items: [...items.map((x) => ({ id: x.key })), { id: 'khong-con' }],
      pos: 2,
      results: [
        { i: 0, g: 2, score: 96 },
        { i: 1, g: null },
      ],
      t0: NOW - 60_000,
      minutes: 0,
      savedAt: NOW,
    };
    const r = resolveActive(saved, NOW + 1000);
    expect(r).toMatchObject({ done: 2, total: 4 });
    const t = r!.target;
    if (t.kind !== 'en' || t.view.kind !== 'dictation') throw new Error('sai kiểu');
    expect(t.view.list).toEqual(items);
    expect(t.view.pos).toBe(2);
    expect(t.view.done).toEqual([{ it: items[0], score: 96 }]);
    // Quá 12 giờ thì bỏ.
    expect(resolveActive(saved, NOW + 13 * 3600_000)).toBeNull();
  });
});
