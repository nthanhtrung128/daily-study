/**
 * Cỡ chữ trong app: "Theo máy" (mặc định) hoặc chọn tay Nhỏ / Vừa / Lớn / Rất lớn.
 * - Theo máy: trên iPhone/iPad cỡ gốc theo Cài đặt iPhone › Màn hình & Độ sáng › Cỡ chữ và Trợ năng › Chữ lớn hơn
 *   (CSS `font: -apple-system-body`, xem src/ui/styles.css); trình duyệt khác 15 px.
 * - Chọn tay: 15 px × hệ số, đặt bằng thuộc tính `data-fs` trên <html>.
 * Lưu trong localStorage như lựa chọn sáng/tối để áp dụng trước lần render đầu (không nháy cỡ chữ).
 */
export const FONT_SIZES = ['auto', 'sm', 'md', 'lg', 'xl'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

/** Hệ số nhân trên cỡ gốc 15 px (khớp các khối :root[data-fs] trong styles.css). */
export const FONT_SCALE: Record<Exclude<FontSize, 'auto'>, number> = { sm: 0.9, md: 1, lg: 1.15, xl: 1.3 };

export const FONT_SIZE_LABELS: Record<FontSize, string> = { auto: 'Theo máy', sm: 'Nhỏ', md: 'Vừa', lg: 'Lớn', xl: 'Rất lớn' };

const KEY = 'ds.fontSize';

export function isFontSize(v: unknown): v is FontSize {
  return typeof v === 'string' && (FONT_SIZES as readonly string[]).includes(v);
}

export function loadFontSize(): FontSize {
  try {
    const v = localStorage.getItem(KEY);
    return isFontSize(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyFontSize(size: FontSize, root: HTMLElement = document.documentElement): void {
  if (size === 'auto') root.removeAttribute('data-fs');
  else root.setAttribute('data-fs', size);
}

export function saveFontSize(size: FontSize): void {
  try {
    localStorage.setItem(KEY, size);
  } catch {
    /* chế độ riêng tư: bỏ qua, vẫn áp dụng trong phiên */
  }
  applyFontSize(size);
}
