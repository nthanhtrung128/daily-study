import { addDays } from '../../core/date';
import type { DayStat } from '../../core/db';
import { levelOf, type LeitnerState } from '../../core/leitner';
import { BAI_KEYS } from '../tr/data';
import { ITEMS, type TrItem } from '../tr/items';
import { PATTERNS, PHRASES, enId } from '../lookup';

/** Số liệu trang Tiến độ — tính thuần từ trạng thái Leitner và thống kê ngày (giữ như bản cũ). */
type StateOf = (id: string) => LeitnerState | undefined;

export interface BarRow {
  key: string;
  n: number;
  /** Đang học (hộp 1–3). */
  l1: number;
  /** Đã thuộc (hộp ≥ 4). */
  l2: number;
}

/** Mỗi buổi: số mục (bỏ thuật ngữ và bài tính như bản cũ), đã thuộc, đang học. */
export function baiRows(stateOf: StateOf, items: readonly TrItem[] = ITEMS): BarRow[] {
  return BAI_KEYS.map((k) => count(k, items.filter((i) => i.type !== 'term' && i.type !== 'calc' && i.bai.includes(k)).map((i) => i.id), stateOf));
}

/** Hàng phụ: thuật ngữ TR và tiếng Anh (cụm từ, câu mẫu). */
export function extraRows(stateOf: StateOf, items: readonly TrItem[] = ITEMS): BarRow[] {
  return [
    count('term', items.filter((i) => i.type === 'term').map((i) => i.id), stateOf),
    count('phrase', PHRASES.map((p) => enId(p.id)), stateOf),
    count('pattern', PATTERNS.map((p) => enId(p.id)), stateOf),
  ];
}

function count(key: string, ids: readonly string[], stateOf: StateOf): BarRow {
  let l1 = 0;
  let l2 = 0;
  for (const id of ids) {
    const l = levelOf(stateOf(id));
    if (l === 2) l2++;
    else if (l === 1) l1++;
  }
  return { key, n: ids.length, l1, l2 };
}

export interface HeatCell {
  day: string;
  n: number;
  /** 0–3 như bản cũ: 0 lượt, 1–11, 12–29, ≥ 30. */
  lv: 0 | 1 | 2 | 3;
}

export const heatLevel = (n: number): HeatCell['lv'] => (n >= 30 ? 3 : n >= 12 ? 2 : n > 0 ? 1 : 0);

/** `days` ô, cũ → mới, ô cuối là hôm nay. */
export function heatCells(countOf: (day: string) => number, today: string, days = 35): HeatCell[] {
  const out: HeatCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const n = countOf(day);
    out.push({ day, n, lv: heatLevel(n) });
  }
  return out;
}

export function totals(days: Iterable<DayStat>) {
  let n = 0;
  let s = 0;
  let active = 0;
  for (const d of days) {
    n += d.n;
    s += d.s || 0;
    if (d.n > 0) active++;
  }
  return { n, s, active };
}

export function learnedCount(entries: Iterable<[string, LeitnerState]>): number {
  let c = 0;
  for (const [, s] of entries) if (levelOf(s) === 2) c++;
  return c;
}

/** Mục hay quên / sai nhất (lần sai giảm dần), bỏ id không còn trong dữ liệu. */
export function hardest(entries: Iterable<[string, LeitnerState]>, known: (id: string) => boolean, limit = 12): [string, LeitnerState][] {
  return [...entries]
    .filter(([id, s]) => s.wrong > 0 && known(id))
    .sort((a, b) => b[1].wrong - a[1].wrong || b[1].last - a[1].last)
    .slice(0, limit);
}
