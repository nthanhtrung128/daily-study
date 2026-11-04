import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { FONT_SCALE, FONT_SIZES, applyFontSize, loadFontSize, saveFontSize } from '../../src/core/fontsize';

describe('cỡ chữ', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-fs');
  });

  it('mặc định theo máy, không đặt data-fs', () => {
    expect(loadFontSize()).toBe('auto');
    applyFontSize(loadFontSize());
    expect(document.documentElement.hasAttribute('data-fs')).toBe(false);
  });

  it('lưu và áp dụng ngay, đọc lại được ở lần mở sau', () => {
    saveFontSize('xl');
    expect(document.documentElement.dataset.fs).toBe('xl');
    expect(localStorage.getItem('ds.fontSize')).toBe('xl');
    document.documentElement.removeAttribute('data-fs');
    // Lần mở sau: main.tsx gọi applyFontSize(loadFontSize()) trước khi render.
    applyFontSize(loadFontSize());
    expect(document.documentElement.dataset.fs).toBe('xl');
    saveFontSize('auto');
    expect(document.documentElement.hasAttribute('data-fs')).toBe(false);
    expect(loadFontSize()).toBe('auto');
  });

  it('bỏ qua giá trị rác', () => {
    localStorage.setItem('ds.fontSize', '200%');
    expect(loadFontSize()).toBe('auto');
  });

  it('localStorage hỏng (chế độ riêng tư): vẫn áp dụng trong phiên', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => saveFontSize('lg')).not.toThrow();
      expect(document.documentElement.dataset.fs).toBe('lg');
    } finally {
      Storage.prototype.setItem = orig;
    }
  });

  it('CSS có đủ khối cho mọi cỡ, đúng hệ số, và Dynamic Type trên iOS', () => {
    const css = readFileSync(join(__dirname, '../../src/ui/styles.css'), 'utf8');
    for (const s of FONT_SIZES.filter((x) => x !== 'auto')) {
      const m = new RegExp(`:root\\[data-fs='${s}'\\] \\{ font-size: (?:calc\\(15px \\* ([\\d.]+)\\)|15px); \\}`).exec(css);
      expect(m, s).not.toBeNull();
      expect(Number(m![1] ?? 1)).toBe(FONT_SCALE[s as keyof typeof FONT_SCALE]);
    }
    expect(css).toMatch(/@supports \(font: -apple-system-body\)[\s\S]*?html \{ font: -apple-system-body; font-family: var\(--f-body\)/);
    expect(css).toMatch(/html \{[^}]*font-size: 15px/);
  });
});
