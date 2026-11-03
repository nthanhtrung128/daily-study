import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, loadTheme, saveTheme } from '../../src/core/theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('mặc định theo máy', () => {
    expect(loadTheme()).toBe('auto');
  });

  it('lưu và áp dụng sáng/tối', () => {
    saveTheme('dark');
    expect(loadTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('bỏ qua giá trị rác', () => {
    localStorage.setItem('ds.theme', 'tím');
    expect(loadTheme()).toBe('auto');
  });

  it('theme-color của thanh trạng thái theo lựa chọn Sáng/Tối, về mặc định khi Theo máy', () => {
    document.head.innerHTML =
      '<meta name="theme-color" content="#EEF1F4" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0E1318" media="(prefers-color-scheme: dark)">';
    const colors = () => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content'));
    applyTheme('dark');
    expect(colors()).toEqual(['#0E1318', '#0E1318']);
    applyTheme('light');
    expect(colors()).toEqual(['#EEF1F4', '#EEF1F4']);
    applyTheme('auto');
    expect(colors()).toEqual(['#EEF1F4', '#0E1318']);
  });
});
