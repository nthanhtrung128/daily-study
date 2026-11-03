import type { LeitnerState } from './leitner';
import { defaultRng, type Rng } from './rng';
import { priority, type SessionItem } from './session';

/**
 * Lập phiên hằng ngày trộn hai "làn" (TR và tiếng Anh) — hàm thuần, tái lập được với rng gieo hạt.
 *
 * 1. Mỗi mục được xếp bậc theo `priority` (giống buildSession): đến hạn (từng sai lên trước) > từng sai ở hộp thấp
 *    > mục mới > đã học chưa đến hạn (bỏ). Trong cùng bậc thứ tự ngẫu nhiên theo rng.
 * 2. Tỉ lệ TR/EN tính theo THỜI GIAN ước tính: mỗi bước chọn làn có (thời gian đã dùng + mục kế tiếp) / tỉ lệ nhỏ nhất
 *    (kiểu xếp hàng công bằng có trọng số), nên hai làn tự xen kẽ.
 * 3. Không để một làn chạy quá `maxRun` mục liên tiếp khi làn kia còn mục.
 * 4. Trong một làn: lấy bậc cao nhất còn mục; giữa các loại có mục ở bậc đó, chọn loại đang thiếu nhất so với tỉ lệ loại.
 * 5. Mục mới bị giới hạn bởi `maxNew` (chung cả hai làn).
 * 6. Hết ngân sách thời gian thì dừng (vượt tối đa một mục). Một làn cạn thì làn kia lấp phần còn lại.
 * 7. Mục "thêm" (luyện nói) — nếu có — tính vào làn EN, chèn ở khoảng 2/3 phiên, cạnh một mục TR.
 */
export type Lane = 'tr' | 'en';
export type Tier = 'due' | 'wrong' | 'new' | 'extra';

export interface LaneSpec<T extends SessionItem> {
  items: readonly T[];
  /** Tỉ lệ số mục theo loại trong làn (loại không có ở đây bị bỏ). */
  weights: Readonly<Record<string, number>>;
  /** Giây ước tính theo loại. */
  time: Readonly<Record<string, number>>;
}

export interface MixExtra<X> {
  item: X;
  /** Giây ước tính. */
  secs: number;
}

export interface MixOptions<A extends SessionItem, B extends SessionItem, X = never> {
  tr: LaneSpec<A>;
  en: LaneSpec<B>;
  stateOf: (id: string) => LeitnerState | undefined;
  today: string;
  /** Ngân sách (giây). */
  budget: number;
  /** Tỉ lệ thời gian dành cho TR, 0–1 (mặc định 0,4). */
  trShare?: number;
  /** Số mục mới còn được thêm (mặc định không giới hạn). */
  maxNew?: number;
  /** Số mục liên tiếp tối đa của một làn khi làn kia còn mục (mặc định 3). */
  maxRun?: number;
  /** Mục luyện nói kèm theo (tính vào làn EN). */
  extra?: MixExtra<X> | null;
  rng?: Rng;
}

export type MixEntry<A, B, X = never> =
  | { lane: 'tr'; tier: Exclude<Tier, 'extra'>; secs: number; item: A }
  | { lane: 'en'; tier: Exclude<Tier, 'extra'>; secs: number; item: B }
  | { lane: 'en'; tier: 'extra'; secs: number; item: X };

export interface MixPlan<A, B, X = never> {
  entries: MixEntry<A, B, X>[];
  /** Giây ước tính theo làn (EN gồm cả mục thêm). */
  secs: Record<Lane, number>;
  total: number;
  /** Số mục mới đã đưa vào. */
  fresh: number;
}

export const DEFAULT_TR_SHARE = 0.4;
const TIERS = ['due', 'wrong', 'new'] as const;

export function tierOf(s: LeitnerState | undefined, today: string): Exclude<Tier, 'extra'> | null {
  const p = priority(s, today, () => 0);
  if (p >= 3) return 'due';
  if (p >= 2) return 'wrong';
  if (p >= 1) return 'new';
  return null;
}

interface Queue<T> {
  /** buckets[tier][type] = hàng đợi đã sắp. */
  buckets: Record<(typeof TIERS)[number], Map<string, T[]>>;
  weights: Readonly<Record<string, number>>;
  time: Readonly<Record<string, number>>;
  cnt: Map<string, number>;
}

function makeQueue<T extends SessionItem>(spec: LaneSpec<T>, stateOf: MixOptions<T, T>['stateOf'], today: string, rng: Rng): Queue<T> {
  const ranked: { p: number; tier: (typeof TIERS)[number]; it: T }[] = [];
  for (const it of spec.items) {
    if (!(spec.weights[it.type] ?? 0)) continue;
    const s = stateOf(it.id);
    const tier = tierOf(s, today);
    if (!tier) continue;
    ranked.push({ p: priority(s, today, rng), tier, it });
  }
  ranked.sort((a, b) => b.p - a.p);
  const buckets = { due: new Map<string, T[]>(), wrong: new Map<string, T[]>(), new: new Map<string, T[]>() };
  for (const r of ranked) {
    const m = buckets[r.tier];
    const arr = m.get(r.it.type) ?? [];
    arr.push(r.it);
    m.set(r.it.type, arr);
  }
  return { buckets, weights: spec.weights, time: spec.time, cnt: new Map() };
}

/** Mục kế tiếp của một làn (chưa lấy ra). `allowNew` = còn hạn mức mục mới. */
function peek<T extends SessionItem>(q: Queue<T>, allowNew: boolean): { tier: (typeof TIERS)[number]; type: string } | null {
  const total = [...q.cnt.values()].reduce((a, b) => a + b, 0) + 1;
  for (const tier of TIERS) {
    if (tier === 'new' && !allowNew) break;
    let best: string | null = null;
    let bestGap = Infinity;
    for (const [type, arr] of q.buckets[tier]) {
      if (!arr.length) continue;
      const gap = (q.cnt.get(type) ?? 0) / total - (q.weights[type] ?? 0);
      if (gap < bestGap) {
        bestGap = gap;
        best = type;
      }
    }
    if (best) return { tier, type: best };
  }
  return null;
}

export function planMix<A extends SessionItem, B extends SessionItem, X = never>(o: MixOptions<A, B, X>): MixPlan<A, B, X> {
  const rng = o.rng ?? defaultRng;
  const share = Math.min(1, Math.max(0, o.trShare ?? DEFAULT_TR_SHARE));
  const w: Record<Lane, number> = { tr: share, en: 1 - share };
  const maxRun = Math.max(1, o.maxRun ?? 3);
  let newLeft = Math.max(0, o.maxNew ?? Infinity);

  const queues = {
    tr: makeQueue<A>(o.tr, o.stateOf, o.today, rng),
    en: makeQueue<B>(o.en, o.stateOf, o.today, rng),
  };
  const used: Record<Lane, number> = { tr: 0, en: 0 };
  const extra = o.extra && o.extra.secs <= o.budget && w.en > 0 ? o.extra : null;
  if (extra) used.en += extra.secs;

  type Core = Exclude<MixEntry<A, B, X>, { tier: 'extra' }>;
  const out: Core[] = [];
  let run: { lane: Lane | null; n: number } = { lane: null, n: 0 };
  let guard = 0;

  while (used.tr + used.en < o.budget && guard++ < 1000) {
    const cand: { lane: Lane; next: NonNullable<ReturnType<typeof peek>>; cost: number }[] = [];
    for (const lane of ['tr', 'en'] as const) {
      if (!w[lane]) continue;
      const q = queues[lane] as Queue<SessionItem>;
      const next = peek(q, newLeft > 0);
      if (next) cand.push({ lane, next, cost: q.time[next.type] ?? 30 });
    }
    if (!cand.length) break;
    // Điểm = thời gian sau khi lấy / tỉ lệ; bằng nhau thì ưu tiên TR (thường là mục đến hạn nặng hơn).
    cand.sort((a, b) => (used[a.lane] + a.cost) / w[a.lane] - (used[b.lane] + b.cost) / w[b.lane]);
    let pick = cand[0]!;
    if (cand.length > 1 && run.lane === pick.lane && run.n >= maxRun) pick = cand[1]!;

    const q = queues[pick.lane] as Queue<SessionItem>;
    const it = q.buckets[pick.next.tier].get(pick.next.type)!.shift()!;
    q.cnt.set(pick.next.type, (q.cnt.get(pick.next.type) ?? 0) + 1);
    if (pick.next.tier === 'new') newLeft--;
    used[pick.lane] += pick.cost;
    run = run.lane === pick.lane ? { lane: pick.lane, n: run.n + 1 } : { lane: pick.lane, n: 1 };
    out.push({ lane: pick.lane, tier: pick.next.tier, secs: pick.cost, item: it } as Core);
  }

  const entries: MixEntry<A, B, X>[] = out;
  if (extra) {
    // Chèn ở khoảng 2/3 phiên, ngay sau một mục TR và không làm chuỗi EN dài quá maxRun; không có chỗ như vậy thì
    // lấy chỗ gần nhất sau một mục TR, cuối cùng là đúng vị trí 2/3.
    const target = Math.round((out.length * 2) / 3);
    const enRunFrom = (k: number) => {
      let n = 0;
      while (out[k + n]?.lane === 'en') n++;
      return n;
    };
    const positions = Array.from({ length: out.length }, (_, k) => k + 1).sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b);
    const afterTr = positions.filter((k) => out[k - 1]?.lane === 'tr');
    const at = afterTr.find((k) => enRunFrom(k) + 1 <= maxRun) ?? afterTr[0] ?? target;
    entries.splice(Math.min(at, out.length), 0, { lane: 'en', tier: 'extra', secs: extra.secs, item: extra.item });
  }
  const fresh = out.filter((e) => e.tier === 'new').length;
  return { entries, secs: { ...used }, total: used.tr + used.en, fresh };
}

/** Độ dài chuỗi dài nhất của cùng một làn (dùng để kiểm tra xen kẽ). */
export function longestRun(lanes: readonly Lane[]): number {
  let best = 0;
  let n = 0;
  for (let i = 0; i < lanes.length; i++) {
    n = i > 0 && lanes[i] === lanes[i - 1] ? n + 1 : 1;
    best = Math.max(best, n);
  }
  return best;
}
