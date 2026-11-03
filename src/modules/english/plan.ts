import { isDue, levelOf, type LeitnerState } from '../../core/leitner';
import { buildSession } from '../../core/session';
import { defaultRng, type Rng } from '../../core/rng';
import { EN_ITEMS, type EnItem, type EnType, type Topic } from './content';

/**
 * Lập phiên tiếng Anh bằng cùng thuật toán buildSession của TR:
 * mục đến hạn (+ từng quên) trước, rồi mục từng quên ở hộp thấp, rồi mục mới; bỏ mục đã học chưa đến hạn.
 * (Trộn TR 40% / EN 60% thành một phiên là việc của S8.)
 */
export const EN_DURATIONS = [5, 10, 15] as const;

/** Giây ước tính cho mỗi loại mục. */
export const EN_TIME: Record<EnType, number> = { phrase: 30, pattern: 75 };

export interface EnPlanOptions {
  minutes: number;
  topics?: readonly Topic[];
  rng?: Rng;
  dry?: boolean;
  items?: readonly EnItem[];
}

const topicOf = (it: EnItem): Topic => (it.type === 'phrase' ? it.ph.topic : it.pt.topic);

export function planEnglish(
  type: EnType,
  stateOf: (id: string) => LeitnerState | undefined,
  today: string,
  o: EnPlanOptions,
): EnItem[] {
  const topics = o.topics ?? [];
  return buildSession<EnItem>({
    items: o.items ?? EN_ITEMS,
    stateOf,
    today,
    budget: o.minutes * 60,
    weights: { [type]: 1 },
    time: EN_TIME,
    dropNotDue: true,
    inScope: (i) => !topics.length || topics.includes(topicOf(i)),
    ...(o.dry !== undefined ? { dry: o.dry } : {}),
    ...(o.rng ? { rng: o.rng } : {}),
  });
}

/** Danh sách thẻ EN đến hạn hôm nay (đã học, due ≤ hôm nay), từng quên lên trước. */
export function dueEnglish(
  stateOf: (id: string) => LeitnerState | undefined,
  today: string,
  type?: EnType,
  items: readonly EnItem[] = EN_ITEMS,
): EnItem[] {
  return items
    .filter((i) => (!type || i.type === type) && isDue(stateOf(i.id), today))
    .sort((a, b) => (stateOf(b.id)?.wrong ?? 0) - (stateOf(a.id)?.wrong ?? 0) || (stateOf(a.id)?.due ?? '').localeCompare(stateOf(b.id)?.due ?? ''));
}

export interface EnStats {
  total: number;
  due: number;
  learned: number;
  fresh: number;
}

export function enStats(stateOf: (id: string) => LeitnerState | undefined, today: string, type: EnType, items: readonly EnItem[] = EN_ITEMS): EnStats {
  const list = items.filter((i) => i.type === type);
  return {
    total: list.length,
    due: list.filter((i) => isDue(stateOf(i.id), today)).length,
    learned: list.filter((i) => levelOf(stateOf(i.id)) === 2).length,
    fresh: list.filter((i) => !stateOf(i.id)?.box).length,
  };
}

/** Chiều thẻ từ: EN→VI (nhận diện) hoặc VI→EN (nhớ chủ động). */
export type CardDir = 'en-vi' | 'vi-en';

/** Mục mới luôn bắt đầu EN→VI; mục đã học thì xen kẽ ngẫu nhiên, hộp cao nghiêng về VI→EN (khó hơn). */
export function cardDir(state: LeitnerState | undefined, rng: Rng = defaultRng): CardDir {
  const box = state?.box ?? 0;
  if (!box) return 'en-vi';
  const pViEn = box >= 3 ? 0.65 : 0.5;
  return rng() < pViEn ? 'vi-en' : 'en-vi';
}
