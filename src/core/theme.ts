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

/** Màu thanh trạng thái (meta theme-color) — khớp --bg sáng/tối trong styles.css. */
export const THEME_COLOR = { light: '#EEF1F4', dark: '#0E1318' } as const;

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  // Chọn tay Sáng/Tối thì thanh trạng thái (Safari, app ở Màn hình chính) cũng theo, không theo máy.
  const doc = root.ownerDocument;
  for (const m of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own: keyof typeof THEME_COLOR = /dark/.test(m.getAttribute('media') ?? '') ? 'dark' : 'light';
    m.content = THEME_COLOR[theme === 'auto' ? own : theme];
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* chế độ riêng tư: bỏ qua, vẫn áp dụng trong phiên */
  }
  applyTheme(theme);
}
