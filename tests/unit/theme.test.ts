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
});
