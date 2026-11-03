import { isDue, type LeitnerState } from './leitner';
import { defaultRng, shuffle, type Rng } from './rng';

/**
 * Lập phiên ôn theo thời lượng và tỷ lệ loại mục (giữ thuật toán bản cũ):
 * 1. Mỗi loại có một hàng đợi sắp theo độ ưu tiên: đến hạn (+ từng sai) > từng sai ở hộp thấp > mục mới > còn lại.
 * 2. Lần lượt lấy từ loại đang "thiếu" nhiều nhất so với tỷ lệ mong muốn, cộng thời gian ước tính, tới khi hết ngân sách.
 * 3. Loại "lặp được" (bài tính: số sinh ngẫu nhiên mỗi lần) xoay vòng, không cạn.
 */
export interface SessionItem {
  id: string;
  type: string;
}

export interface SessionOptions<T extends SessionItem> {
  items: readonly T[];
  stateOf: (id: string) => LeitnerState | undefined;
  today: string;
  /** Ngân sách thời gian (giây). */
  budget: number;
  /** Tỷ lệ mong muốn theo loại (tổng ≈ 1). Loại không có ở đây bị bỏ. */
  weights: Readonly<Record<string, number>>;
  /** Giây ước tính cho một mục theo loại. */
  time: Readonly<Record<string, number>>;
  /** Loại lặp được (không cạn hàng đợi). */
  repeatable?: readonly string[];
  /** Chỉ lấy mục đến hạn hoặc từng sai ở hộp < 3 (không thêm mục mới). */
  reviewOnly?: boolean;
  /** Bỏ mục đã học chưa đến hạn (độ ưu tiên < 1), trừ loại lặp được. */
  dropNotDue?: boolean;
  /** Lọc phạm vi (vd theo buổi học). */
  inScope?: (item: T) => boolean;
  /** true: giữ thứ tự lập (để xem trước); false: xáo trộn. */
  dry?: boolean;
  rng?: Rng;
}

export function priority(s: LeitnerState | undefined, today: string, rng: Rng = defaultRng): number {
  if (!s || !s.box) return 1 + rng() * 0.5;
  if (s.due <= today) return 3 + (s.wrong ? 1 : 0) + rng() * 0.5;
  if (s.wrong > 0 && s.box < 3) return 2 + rng() * 0.3;
  return rng() * 0.2;
}

/** Mục cần ôn lại: đến hạn, hoặc từng sai và còn ở hộp thấp. */
export function needsReview(s: LeitnerState | undefined, today: string): boolean {
  return isDue(s, today) || (!!s && s.wrong > 0 && s.box < 3);
}

export function buildSession<T extends SessionItem>(o: SessionOptions<T>): T[] {
  const rng = o.rng ?? defaultRng;
  const repeat = new Set(o.repeatable ?? []);
  const types = Object.keys(o.weights);
  const pools: Record<string, T[]> = {};
  for (const t of types) {
    let arr = o.items.filter((i) => i.type === t && (o.inScope ? o.inScope(i) : true));
    if (o.reviewOnly) arr = arr.filter((i) => needsReview(o.stateOf(i.id), o.today));
    let ranked = arr.map((i) => [priority(o.stateOf(i.id), o.today, rng), i] as const).sort((a, b) => b[0] - a[0]);
    if (o.dropNotDue && !repeat.has(t)) ranked = ranked.filter(([p]) => p >= 1);
    pools[t] = ranked.map((x) => x[1]);
  }

  const out: T[] = [];
  const cnt: Record<string, number> = {};
  const keys = types.filter((t) => (pools[t]?.length ?? 0) > 0);
  let time = 0;
  let guard = 0;
  while (time < o.budget && keys.length && guard++ < 400) {
    const tot = out.length + 1;
    const gap = (t: string) => (cnt[t] ?? 0) / tot - (o.weights[t] ?? 0);
    keys.sort((a, b) => gap(a) - gap(b));
    const t = keys[0] as string;
    const pool = pools[t] ?? [];
    const it = repeat.has(t) ? pool[(cnt[t] ?? 0) % pool.length] : pool.shift();
    if (!it) {
      keys.shift();
      continue;
    }
    if (!repeat.has(t) && !pool.length) keys.splice(keys.indexOf(t), 1);
    out.push(it);
    cnt[t] = (cnt[t] ?? 0) + 1;
    time += o.time[t] ?? 30;
  }
  return o.dry ? out : shuffle(rng, out);
}
