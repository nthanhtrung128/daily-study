import { isDue, type Grade, type LeitnerState } from '../../core/leitner';
import { defaultRng, shuffle, type Rng } from '../../core/rng';
import { PATTERNS, PHRASES, enId } from './content';
import { displayWords, gradeForScore, scoreSpeech, type ScoreResult } from './speech/score';
import { DIALOGUES, type Dialogue } from './tracks';

/**
 * Nghe chép chính tả: nghe câu (TTS) → gõ lại → so từng từ bằng bộ chấm của luyện nói (`speech/score.ts`).
 * Nguồn câu: câu mẫu, câu ví dụ của cụm từ, câu hội thoại.
 * Câu mẫu / ví dụ chấm vào lịch Leitner của chính thẻ đó ("en:pt-…", "en:ph-…"); câu hội thoại không có id nên không chấm Leitner.
 */
export type DictSource = 'pattern' | 'example' | 'dialogue';
export const DICT_SOURCE_VI: Record<DictSource, string> = { pattern: 'Câu mẫu', example: 'Ví dụ cụm từ', dialogue: 'Hội thoại' };

export interface DictItem {
  /** Khóa duy nhất trong phiên. */
  key: string;
  /** Id Leitner (không có với câu hội thoại). */
  id?: string;
  src: DictSource;
  en: string;
  vi: string;
}

/** Số câu mỗi phiên, khoảng độ dài ưu tiên (số từ), điểm trừ khi dùng gợi ý chữ cái đầu. */
export const DICT_COUNT = 8;
export const DICT_MIN_WORDS = 5;
export const DICT_MAX_WORDS = 16;
export const HINT_PENALTY = 10;

export const wordCount = (s: string): number => displayWords(s).length;
export const fitsLength = (s: string): boolean => {
  const n = wordCount(s);
  return n >= DICT_MIN_WORDS && n <= DICT_MAX_WORDS;
};

export function buildDictItems(dialogues: readonly Dialogue[] = DIALOGUES): DictItem[] {
  return [
    ...PATTERNS.map((p): DictItem => ({ key: p.id, id: enId(p.id), src: 'pattern', en: p.en, vi: p.vi })),
    ...PHRASES.map((p): DictItem => ({ key: p.id, id: enId(p.id), src: 'example', en: p.example, vi: `Ví dụ cho “${p.en}” — ${p.vi}` })),
    ...dialogues.flatMap((d) => d.lines.map((l, i): DictItem => ({ key: `${d.id}:${i + 1}`, src: 'dialogue', en: l.en, vi: l.vi }))),
  ];
}

export const DICT_ITEMS: readonly DictItem[] = buildDictItems();

/**
 * Chọn câu cho phiên: (1) mục có id đang đến hạn, (2) mục đã học chưa đến hạn, (3) còn lại (mục mới + câu hội thoại).
 * Trong từng nhóm xáo ngẫu nhiên; câu 5–16 từ luôn xếp trước, chỉ lấy câu ngoài khoảng khi không đủ.
 */
export function planDictation(
  stateOf: (id: string) => LeitnerState | undefined,
  today: string,
  o: { count?: number; items?: readonly DictItem[]; rng?: Rng } = {},
): DictItem[] {
  const count = o.count ?? DICT_COUNT;
  const tier = (it: DictItem): number => {
    const s = it.id ? stateOf(it.id) : undefined;
    return isDue(s, today) ? 0 : s ? 1 : 2;
  };
  const pool = shuffle(o.rng ?? defaultRng, o.items ?? DICT_ITEMS).map((it) => ({ it, rank: (fitsLength(it.en) ? 0 : 3) + tier(it) }));
  // sort ổn định: giữ thứ tự xáo trong cùng hạng.
  return pool
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count)
    .map((x) => x.it);
}

/** Chấm câu gõ: như chấm nói (hoa/thường, dấu câu, viết tắt, số); dùng gợi ý thì trừ `HINT_PENALTY` điểm. */
export function scoreDictation(target: string, typed: string, hint = false): ScoreResult {
  const r = scoreSpeech(target, typed);
  return hint ? { ...r, score: Math.max(0, r.score - HINT_PENALTY) } : r;
}

/** Điểm → mức Leitner (≥ 90 nhớ rõ, 60–89 mơ hồ, < 60 quên); mục không có id thì không chấm (null). */
export const dictGrade = (it: Pick<DictItem, 'id'>, score: number): Grade | null => (it.id ? gradeForScore(score) : null);

/** Các từ nghe sai / thiếu nhiều nhất trong phiên (bỏ dấu câu, chữ thường), nhiều → ít. */
export function missedWords(results: readonly ScoreResult[], top = 8): { word: string; n: number }[] {
  const tally = new Map<string, number>();
  for (const r of results)
    for (const w of r.words) {
      if (w.status === 'ok') continue;
      const word = w.text.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (word) tally.set(word, (tally.get(word) ?? 0) + 1);
    }
  return [...tally].map(([word, n]) => ({ word, n })).sort((a, b) => b.n - a.n).slice(0, top);
}

/** Gợi ý: chữ cái đầu mỗi từ, phần còn lại thay bằng gạch ("I'd like" → "I__ l___"). */
export const firstLetters = (text: string): string =>
  displayWords(text)
    .map((w) => w.replace(/[\p{L}\p{N}]/gu, (c, k: number, s: string) => (s.search(/[\p{L}\p{N}]/u) === k ? c : '_')))
    .join(' ');
