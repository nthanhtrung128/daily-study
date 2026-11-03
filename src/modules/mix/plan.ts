import type { LeitnerState } from '../../core/leitner';
import { planMix, type MixEntry, type MixPlan } from '../../core/mix';
import type { DailyPrefs } from '../../core/prefs';
import { defaultRng, pick, type Rng } from '../../core/rng';
import { EN_ITEMS, type EnItem } from '../english/content';
import { EN_TIME } from '../english/plan';
import { SAY_ITEMS, planSpeaking, type SayItem } from '../english/speech/sayItems';
import { SPEAKING_TOPICS, type SpeakingTopic } from '../english/speech/topics';
import { ITEMS, type TrItem } from '../tr/items';
import { TIME, modeOf } from '../tr/plan';

/**
 * Phiên hằng ngày trộn TR + tiếng Anh: nối dữ liệu thật (ngân hàng TR, cụm từ/câu mẫu EN, câu nói / đề nói)
 * với thuật toán thuần `planMix` ở src/core/mix.ts.
 */
export type SpeakExtra = { kind: 'say'; id: string; item: SayItem } | { kind: 'topic'; id: string; topic: SpeakingTopic };
export type DailyEntry = MixEntry<TrItem, EnItem, SpeakExtra>;
export type DailyPlan = MixPlan<TrItem, EnItem, SpeakExtra>;

/** Tỉ lệ loại trong làn TR: giống cách ôn "Hỗn hợp" của TR. */
export const TR_LANE_WEIGHTS = modeOf('mix').weights as Record<string, number>;
/** Tỉ lệ loại trong làn EN: cụm từ nhiều hơn câu mẫu (câu mẫu lâu hơn). */
export const EN_LANE_WEIGHTS: Record<string, number> = { phrase: 0.6, pattern: 0.4 };

/** Giây ước tính cho phần luyện nói kèm theo. */
export const SAY_SECS = 60;
export const TOPIC_SECS = 150;
/** Từ 15 phút: kèm 1 đề nói 1 phút; 10–14 phút: kèm 1 câu nói có chấm; dưới 10 phút: không kèm. */
export const TOPIC_FROM_MIN = 15;
export const SAY_FROM_MIN = 10;

export function pickSpeak(
  minutes: number,
  stateOf: (id: string) => LeitnerState | undefined,
  today: string,
  rng: Rng,
  topics: readonly SpeakingTopic[] = SPEAKING_TOPICS,
  sayItems: readonly SayItem[] = SAY_ITEMS,
): { item: SpeakExtra; secs: number } | null {
  if (minutes >= TOPIC_FROM_MIN && topics.length) {
    const topic = pick(rng, topics);
    return { item: { kind: 'topic', id: `topic:${topic.id}`, topic }, secs: TOPIC_SECS };
  }
  if (minutes >= SAY_FROM_MIN) {
    const [item] = planSpeaking(stateOf, today, { count: 1, rng, items: sayItems });
    if (item) return { item: { kind: 'say', id: item.id, item }, secs: SAY_SECS };
  }
  return null;
}

export interface DailyPlanOptions {
  /** Ghi đè thời lượng (vd "Ôn thêm 5 phút"). */
  minutes?: number;
  /** Số mục mới đã học hôm nay (trừ vào hạn mức). */
  newToday?: number;
  rng?: Rng;
  trItems?: readonly TrItem[];
  enItems?: readonly EnItem[];
  topics?: readonly SpeakingTopic[];
  sayItems?: readonly SayItem[];
}

export function planDaily(
  prefs: Pick<DailyPrefs, 'min' | 'trShare' | 'maxNew' | 'speak'>,
  stateOf: (id: string) => LeitnerState | undefined,
  today: string,
  o: DailyPlanOptions = {},
): DailyPlan {
  const rng = o.rng ?? defaultRng;
  const minutes = o.minutes ?? prefs.min;
  const extra = prefs.speak && prefs.trShare < 1 ? pickSpeak(minutes, stateOf, today, rng, o.topics, o.sayItems) : null;
  return planMix<TrItem, EnItem, SpeakExtra>({
    tr: { items: o.trItems ?? ITEMS, weights: TR_LANE_WEIGHTS, time: TIME },
    en: { items: o.enItems ?? EN_ITEMS, weights: EN_LANE_WEIGHTS, time: EN_TIME },
    stateOf,
    today,
    budget: minutes * 60,
    trShare: prefs.trShare,
    maxNew: Math.max(0, prefs.maxNew - (o.newToday ?? 0)),
    extra,
    rng,
  });
}

/** Tóm tắt kế hoạch: "12 mục · TR 5 · EN 7 · 1 đề nói". */
export function summarize(plan: DailyPlan): { tr: number; en: number; speak: SpeakExtra['kind'] | null; minutes: number } {
  let tr = 0;
  let en = 0;
  let speak: SpeakExtra['kind'] | null = null;
  for (const e of plan.entries) {
    if (e.tier === 'extra') speak = e.item.kind;
    else if (e.lane === 'tr') tr++;
    else en++;
  }
  return { tr, en, speak, minutes: Math.round(plan.total / 60) };
}
