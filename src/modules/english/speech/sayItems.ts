import type { LeitnerState } from '../../../core/leitner';
import { defaultRng, type Rng } from '../../../core/rng';
import { buildSession } from '../../../core/session';
import { PATTERNS, PHRASES, type Topic } from '../content';
import { DIALOGUES, type Dialogue } from '../tracks';

/**
 * Câu để luyện "nói có chấm": câu mẫu, câu ví dụ của cụm từ, câu trong hội thoại (S7, nếu có).
 * Lịch Leitner riêng cho kỹ năng nói, id "en:say:<id nội dung>" — không đụng lịch thẻ từ / câu mẫu.
 */
export type SaySource = 'pattern' | 'example' | 'dialogue';
export const SAY_SOURCE_VI: Record<SaySource, string> = { pattern: 'Câu mẫu', example: 'Ví dụ cụm từ', dialogue: 'Hội thoại' };

export interface SayItem {
  id: string;
  type: 'say';
  src: SaySource;
  en: string;
  vi: string;
  label: string;
  topic: Topic;
}

export const sayId = (contentId: string): string => `en:say:${contentId}`;

/** Câu hội thoại đủ dài để chấm (≥ 4 từ). */
const longEnough = (s: string) => s.trim().split(/\s+/).length >= 4;

export function buildSayItems(dialogues: readonly Dialogue[] = DIALOGUES): SayItem[] {
  return [
    ...PATTERNS.map((p): SayItem => ({ id: sayId(p.id), type: 'say', src: 'pattern', en: p.en, vi: p.vi, label: p.situation, topic: p.topic })),
    ...PHRASES.map((p): SayItem => ({ id: sayId(p.id), type: 'say', src: 'example', en: p.example, vi: `Ví dụ cho “${p.en}” — ${p.vi}`, label: p.en, topic: p.topic })),
    ...dialogues.flatMap((d) =>
      d.lines
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => longEnough(l.en))
        .map(({ l, i }): SayItem => ({ id: sayId(`${d.id}:${i + 1}`), type: 'say', src: 'dialogue', en: l.en, vi: l.vi, label: d.title, topic: d.topic })),
    ),
  ];
}

export const SAY_ITEMS: readonly SayItem[] = buildSayItems();

/** Số câu mỗi lượt luyện nói. */
export const SAY_COUNTS = [5, 10, 15] as const;

/** Lập lượt luyện nói: câu đến hạn / từng nói sai trước, rồi câu mới (cùng thuật toán buildSession). */
export function planSpeaking(
  stateOf: (id: string) => LeitnerState | undefined,
  today: string,
  o: { count: number; sources?: readonly SaySource[]; items?: readonly SayItem[]; rng?: Rng; dry?: boolean },
): SayItem[] {
  const sources = o.sources ?? [];
  const list = buildSession<SayItem>({
    items: o.items ?? SAY_ITEMS,
    stateOf,
    today,
    budget: o.count * 40,
    weights: { say: 1 },
    time: { say: 40 },
    dropNotDue: true,
    inScope: (i) => !sources.length || sources.includes(i.src),
    rng: o.rng ?? defaultRng,
    ...(o.dry !== undefined ? { dry: o.dry } : {}),
  });
  return list.slice(0, o.count);
}
