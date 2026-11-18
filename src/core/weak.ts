import { LEARNED_BOX, type LeitnerState } from './leitner';

/**
 * Độ "yếu" của một mục — hàm thuần, tính từ trạng thái Leitner (`wrong`, `box`, `last`):
 *
 *   độ yếu = wrong × (4 − box) / 3  +  (box = 1 và ôn lần cuối ≤ 3 ngày trước ? 2 : 0)
 *
 * - Hộp 1 tính đủ số lần sai, hộp 2 còn 2/3, hộp 3 còn 1/3, hộp ≥ 4 ("Đã thuộc") = 0 → chấm đúng thì độ yếu giảm dần.
 * - Cộng 2 điểm khi mục đang ở hộp 1 và vừa ôn trong 3 ngày gần đây (vừa bị chấm Quên / chưa nhớ lại được).
 * - Mục chưa từng sai (wrong = 0) không phải điểm yếu.
 * Mục là "điểm yếu" khi độ yếu ≥ `WEAK_MIN` (vd: vừa quên 1 lần; sai 2 lần còn ở hộp 1; sai 3 lần ở hộp 2; sai 6 lần ở hộp 3).
 */
export const WEAK_MIN = 2;
export const RECENT_MS = 3 * 24 * 60 * 60 * 1000;
export const RECENT_BONUS = 2;

export function weakness(s: LeitnerState | undefined, now: number): number {
  if (!s || !s.box || s.wrong <= 0 || s.box >= LEARNED_BOX) return 0;
  const recent = s.box === 1 && now - s.last >= 0 && now - s.last <= RECENT_MS;
  return (s.wrong * (4 - s.box)) / 3 + (recent ? RECENT_BONUS : 0);
}

/** Các mục yếu, yếu nhất trước; bằng điểm thì mục ôn gần hơn trước, rồi theo id (ổn định). */
export function rankWeak<T extends { id: string }>(items: readonly T[], stateOf: (id: string) => LeitnerState | undefined, now: number, max = Infinity): T[] {
  return items
    .map((it) => ({ it, w: weakness(stateOf(it.id), now), last: stateOf(it.id)?.last ?? 0 }))
    .filter((x) => x.w >= WEAK_MIN)
    .sort((a, b) => b.w - a.w || b.last - a.last || (a.it.id < b.it.id ? -1 : 1))
    .slice(0, max)
    .map((x) => x.it);
}
