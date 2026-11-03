/**
 * Chuẩn hóa chuỗi để tìm kiếm không phân biệt dấu (như bản cũ):
 * chữ thường, bỏ dấu thanh/dấu mũ (NFD), đ → d, gộp khoảng trắng.
 * "Phụ cấp" và "phu cap" cho cùng một kết quả.
 */
export function fold(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tách truy vấn thành các từ đã chuẩn hóa; mọi từ đều phải có trong mục (AND). */
export function queryTokens(q: string): string[] {
  return fold(q).split(' ').filter(Boolean);
}

/** `hay` đã được fold sẵn. Truy vấn rỗng → khớp mọi mục. */
export function matchesAll(hay: string, tokens: readonly string[]): boolean {
  return tokens.every((t) => hay.includes(t));
}
