/** Tiện ích số. `parseNums` (đọc "1.530", "12,5", "15 %") sẽ chuyển từ bản cũ sang đây ở S2. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
