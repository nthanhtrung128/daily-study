/** Tiện ích số: định dạng vi-VN và đọc số người dùng gõ. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Định dạng số theo vi-VN với đúng d chữ số thập phân: 1530000 → "1.530.000", 12.5 → "12,5". */
export function fmt(n: number, d = 0): string {
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Đọc đáp số người dùng gõ, trả về các cách hiểu có thể (giữ đúng bản cũ):
 * - "1.530.000 đ", "1,530,000" → 1530000; "12,5" / "12.5" → 12,5; "15 %" → 15.
 * - Đúng 3 chữ số sau một dấu ("1.530") → mơ hồ giữa nghìn kiểu VN và thập phân: trả cả hai [1,53; 1530].
 * - Có cả dấu chấm và phẩy: dấu đứng sau cùng là dấu thập phân.
 * Không đọc được → [].
 */
export function parseNums(raw: string): number[] {
  const s = String(raw)
    .trim()
    .replace(/\s|đồng|triệu|nghìn|vnd|đ|%/gi, '');
  if (!s || !/^[-+]?[\d.,]+$/.test(s)) return [];
  const dots = (s.match(/\./g) ?? []).length;
  const coms = (s.match(/,/g) ?? []).length;
  const out = (xs: number[]) => xs.filter((x) => Number.isFinite(x));
  if (dots && coms) {
    return out([
      parseFloat(s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')),
    ]);
  }
  if (coms > 1) return out([parseFloat(s.replace(/,/g, ''))]);
  if (dots > 1) return out([parseFloat(s.replace(/\./g, ''))]);
  const sep = dots ? '.' : coms ? ',' : '';
  if (!sep) return out([parseFloat(s)]);
  const dec = parseFloat(s.replace(sep, '.'));
  const after = s.split(sep)[1] ?? '';
  return out(after.length === 3 ? [dec, parseFloat(s.replace(sep, ''))] : [dec]);
}

/** Đáp số đúng nếu một trong các cách hiểu nằm trong dung sai. */
export function isCorrect(raw: string, ans: number, tol: number): boolean {
  return parseNums(raw).some((x) => Math.abs(x - ans) <= tol + 1e-9);
}
