import { isDue, levelOf, type LeitnerState } from '../../core/leitner';
import { buildSession } from '../../core/session';
import type { Rng } from '../../core/rng';
import { ITEMS, type TrItem, type TrType } from './items';

/** Thời lượng, cách ôn và tỷ lệ loại mục — giữ như bản cũ. */
export const DURATIONS = [5, 10, 15, 20, 30] as const;

export type ModeId = 'mix' | 'flash' | 'quiz' | 'calc' | 'open' | 'term' | 'review';

export interface Mode {
  id: ModeId;
  label: string;
  hint: string;
  weights: Partial<Record<TrType, number>>;
}

export const MODES: readonly Mode[] = [
  { id: 'mix', label: 'Hỗn hợp', hint: 'Đề xuất: ưu tiên mục đến hạn và câu từng sai, rồi thêm mục mới; trộn thẻ, trắc nghiệm, bài tính, câu hỏi mở.', weights: { flash: 0.3, formula: 0.1, quiz: 0.35, calc: 0.15, open: 0.1 } },
  { id: 'flash', label: 'Thẻ ghi nhớ', hint: 'Khái niệm và công thức: tự nhớ lại rồi lật thẻ, tự chấm Quên / Mơ hồ / Nhớ rõ.', weights: { flash: 0.75, formula: 0.25 } },
  { id: 'quiz', label: 'Trắc nghiệm', hint: '121 câu có giải thích; câu sai được đưa vào danh sách ôn lại.', weights: { quiz: 1 } },
  { id: 'calc', label: 'Bài tính', hint: 'Số liệu sinh ngẫu nhiên mỗi lần: midpoint, spread, overlap, compa-ratio, merit, thưởng, COMP, thuế TNCN.', weights: { calc: 1 } },
  { id: 'open', label: 'Câu hỏi mở', hint: 'Câu “Bạn có trả lời được?” Buổi 10 và câu tự kiểm tra từng buổi.', weights: { open: 1 } },
  { id: 'term', label: 'Thuật ngữ Anh – Việt', hint: 'Thẻ thuật ngữ từ Sổ tay thuật ngữ TR (bỏ các mục ít phổ biến).', weights: { term: 1 } },
  { id: 'review', label: 'Chỉ ôn đến hạn & câu sai', hint: 'Không thêm mục mới; dùng khi muốn ôn nhanh phần chưa chắc.', weights: { flash: 0.3, formula: 0.1, quiz: 0.4, open: 0.2 } },
];

/** Giây ước tính cho mỗi loại mục. */
export const TIME: Record<TrType, number> = { flash: 25, formula: 30, term: 15, quiz: 40, calc: 90, open: 75 };

export interface Prefs {
  min: number;
  mode: ModeId;
  bai: string[];
}
export const DEFAULT_PREFS: Prefs = { min: 10, mode: 'mix', bai: [] };

export function modeOf(id: string): Mode {
  return MODES.find((m) => m.id === id) ?? (MODES[0] as Mode);
}

export function inScope(i: TrItem, bai: readonly string[]): boolean {
  if (!bai.length || i.type === 'term') return true;
  return i.bai.some((x) => bai.includes(x));
}

export function planSession(
  prefs: Prefs,
  stateOf: (id: string) => LeitnerState | undefined,
  today: string,
  opts: { dry?: boolean; rng?: Rng; items?: readonly TrItem[] } = {},
): TrItem[] {
  const mode = modeOf(prefs.mode);
  return buildSession<TrItem>({
    items: opts.items ?? ITEMS,
    stateOf,
    today,
    budget: prefs.min * 60,
    weights: mode.weights as Record<string, number>,
    time: TIME,
    repeatable: ['calc'],
    reviewOnly: mode.id === 'review',
    dropNotDue: mode.id === 'mix',
    inScope: (i) => inScope(i, prefs.bai),
    ...(opts.dry !== undefined ? { dry: opts.dry } : {}),
    ...(opts.rng ? { rng: opts.rng } : {}),
  });
}

const TYPE_NAME: Record<TrType, string> = { flash: 'thẻ', formula: 'công thức', quiz: 'trắc nghiệm', calc: 'bài tính', open: 'câu mở', term: 'thuật ngữ' };

export function countBy(list: readonly TrItem[]): string {
  const c = new Map<TrType, number>();
  for (const i of list) c.set(i.type, (c.get(i.type) ?? 0) + 1);
  return [...c].map(([k, v]) => `${v} ${TYPE_NAME[k]}`).join(', ');
}

/** Số liệu trang Hôm nay: mức thuộc (range penetration), đến hạn, từng sai, đã thuộc. */
export function homeStats(stateOf: (id: string) => LeitnerState | undefined, today: string, items: readonly TrItem[] = ITEMS) {
  const tracked = items.filter((i) => i.type !== 'term');
  const pen = tracked.reduce((s, i) => s + Math.min(5, stateOf(i.id)?.box ?? 0) / 5, 0) / (tracked.length || 1);
  return {
    pen,
    tracked: tracked.length,
    learned: tracked.filter((i) => levelOf(stateOf(i.id)) === 2).length,
    due: items.filter((i) => isDue(stateOf(i.id), today)).length,
    wrong: items.filter((i) => (stateOf(i.id)?.wrong ?? 0) > 0).length,
  };
}
