/** Giao diện: theo hệ thống (mặc định), sáng hoặc tối. Lưu trong localStorage để áp dụng ngay khi mở app, tránh nháy màu. */
export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const KEY = 'ds.theme';

export function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v);
}

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return isTheme(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* chế độ riêng tư: bỏ qua, vẫn áp dụng trong phiên */
  }
  applyTheme(theme);
}
