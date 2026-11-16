import { describe, expect, it } from 'vitest';
import type { LeitnerState } from '../../src/core/leitner';
import { seeded } from '../../src/core/rng';
import {
  DICT_COUNT,
  DICT_ITEMS,
  HINT_PENALTY,
  dictGrade,
  firstLetters,
  fitsLength,
  missedWords,
  planDictation,
  scoreDictation,
  wordCount,
  type DictItem,
} from '../../src/modules/english/dictation';

const TODAY = '2026-11-16';
const st = (due: string, box = 2): LeitnerState => ({ box, due }) as LeitnerState;
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const item = (key: string, n: number, id = true): DictItem => ({ key, ...(id ? { id: `en:${key}` } : {}), src: id ? 'pattern' : 'dialogue', en: words(n), vi: '' });

describe('chọn câu cho phiên nghe chép', () => {
  it('nguồn gồm câu mẫu, ví dụ cụm từ (có id Leitner) và câu hội thoại (không id)', () => {
    expect(DICT_ITEMS.some((i) => i.src === 'pattern' && i.id?.startsWith('en:pt-'))).toBe(true);
    expect(DICT_ITEMS.some((i) => i.src === 'example' && i.id?.startsWith('en:ph-'))).toBe(true);
    expect(DICT_ITEMS.some((i) => i.src === 'dialogue' && i.id === undefined)).toBe(true);
    expect(new Set(DICT_ITEMS.map((i) => i.key)).size).toBe(DICT_ITEMS.length);
  });

  it('mặc định 8 câu, không trùng, đều dài 5–16 từ khi còn đủ câu', () => {
    const list = planDictation(() => undefined, TODAY, { rng: seeded(1) });
    expect(list).toHaveLength(DICT_COUNT);
    expect(new Set(list.map((i) => i.key)).size).toBe(DICT_COUNT);
    for (const i of list) expect(fitsLength(i.en)).toBe(true);
  });

  it('ưu tiên: đến hạn → đã học → mục mới / hội thoại; câu ngoài 5–16 từ chỉ lấy khi thiếu', () => {
    const items = [item('new', 8), item('dlg', 8, false), item('learned', 8), item('due', 8), item('due-short', 3), item('due-long', 20)];
    const states: Record<string, LeitnerState> = {
      'en:due': st('2026-11-10'),
      'en:due-short': st('2026-11-10'),
      'en:due-long': st('2026-11-10'),
      'en:learned': st('2026-12-01', 4),
    };
    const plan = (count: number) => planDictation((id) => states[id], TODAY, { count, items, rng: seeded(7) }).map((i) => i.key);
    expect(plan(1)).toEqual(['due']);
    expect(plan(2)).toEqual(['due', 'learned']);
    expect(plan(4).slice(2).sort()).toEqual(['dlg', 'new']);
    expect(plan(6).slice(4).sort()).toEqual(['due-long', 'due-short']);
  });

  it('đếm từ theo từ hiển thị', () => {
    expect(wordCount("I'd like to follow up on that.")).toBe(7);
    expect(fitsLength('Thanks a lot.')).toBe(false);
  });
});

describe('chấm chính tả', () => {
  const T = "I'm afraid we can't approve the 15% increase, John.";

  it('bỏ qua hoa/thường, dấu câu, viết tắt, số', () => {
    expect(scoreDictation(T, 'i am afraid we cannot approve the fifteen percent increase john').score).toBe(100);
    expect(scoreDictation(T, T).score).toBe(100);
  });

  it('từ sai, thiếu, thừa được đánh dấu và trừ điểm', () => {
    const r = scoreDictation('Could you send me the updated salary report by Friday?', 'could you sent me the salary report by next Friday');
    expect(r.words.find((w) => w.text === 'send')).toMatchObject({ status: 'wrong', heard: 'sent' });
    expect(r.words.find((w) => w.text === 'updated')?.status).toBe('missing');
    expect(r.words.find((w) => w.text === 'Friday?')?.extraBefore).toEqual(['next']);
    expect(r.sub).toBe(1);
    expect(r.del).toBe(1);
    expect(r.ins).toBe(1);
    expect(r.score).toBe(75); // (10 − 1 − 1 − 0,5) / 10
  });

  it('dùng gợi ý thì trừ điểm, không âm', () => {
    expect(scoreDictation(T, T, true).score).toBe(100 - HINT_PENALTY);
    expect(scoreDictation(T, 'xyz', true).score).toBe(0);
  });

  it('gợi ý chữ cái đầu giữ dấu câu, che phần còn lại', () => {
    expect(firstLetters("I'd like a follow-up, please.")).toBe("I'_ l___ a f_____-__, p_____.");
  });

  it('gom các từ hay nghe sai trong phiên', () => {
    const a = scoreDictation('Please review the payroll summary.', 'please review the payrol summary');
    const b = scoreDictation('The payroll runs on Friday.', 'the runs on friday');
    expect(missedWords([a, b])).toEqual([{ word: 'payroll', n: 2 }]);
  });
});

describe('điểm → Leitner', () => {
  it('≥ 90 nhớ rõ, 60–89 mơ hồ, < 60 quên; câu hội thoại không chấm', () => {
    const it = { id: 'en:pt-0001' };
    expect(dictGrade(it, 100)).toBe(2);
    expect(dictGrade(it, 90)).toBe(2);
    expect(dictGrade(it, 89)).toBe(1);
    expect(dictGrade(it, 60)).toBe(1);
    expect(dictGrade(it, 59)).toBe(0);
    expect(dictGrade({}, 100)).toBeNull();
  });
});
