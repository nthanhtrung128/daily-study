import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Kiểm tĩnh CSS/TSX: màu chỉ khai báo ở design token trên :root (để sáng/tối tự đổi), có safe-area và giảm chuyển động. */
const ROOT = join(__dirname, '../../src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
const css = files(ROOT).filter((f) => f.endsWith('.css'));
const tsx = files(ROOT).filter((f) => f.endsWith('.tsx'));
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

/** Bỏ các khối khai báo token (:root, :root[data-theme], :root:not(...)) — chỗ duy nhất được viết mã màu. */
function withoutTokenBlocks(src: string): string {
  return src.replace(/:root[^{]*\{[^{}]*\}/g, '');
}

describe('màu không cứng ngoài design token', () => {
  it.each(css.map((f) => [f.slice(ROOT.length + 1), f]))('%s', (_, f) => {
    const lines = withoutTokenBlocks(readFileSync(f, 'utf8'))
      .split('\n')
      .filter((l) => COLOR.test(l.replace(/\/\*.*?\*\//g, '')));
    expect(lines).toEqual([]);
  });

  it('style inline trong TSX không dùng mã màu', () => {
    const bad = tsx.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => /style=\{\{[^}]*(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(l))
        .map((l) => `${f}: ${l.trim()}`),
    );
    expect(bad).toEqual([]);
  });

  it('mọi token màu sáng đều có bản tối (cả hai khối)', () => {
    const s = readFileSync(join(ROOT, 'ui/styles.css'), 'utf8');
    const names = (block: string) => [...block.matchAll(/(--[a-z-]+):\s*#/g)].map((m) => m[1]).sort();
    const light = /:root \{([^}]*)\}/.exec(s)?.[1] ?? '';
    const autoDark = /:root:not\(\[data-theme='light'\]\) \{([^}]*)\}/.exec(s)?.[1] ?? '';
    const forcedDark = /:root\[data-theme='dark'\] \{([^}]*)\}/.exec(s)?.[1] ?? '';
    expect(names(autoDark)).toEqual(names(light));
    expect(names(forcedDark)).toEqual(names(light));
  });
});

describe('iPhone', () => {
  const s = readFileSync(join(ROOT, 'ui/styles.css'), 'utf8');
  it('tôn trọng safe-area 4 phía', () => {
    for (const side of ['top', 'left', 'right', 'bottom']) expect(s).toContain(`env(safe-area-inset-${side}`);
  });
  it('tắt chuyển động khi bật Giảm chuyển động', () => {
    expect(s).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*animation-duration/);
  });
  it('ô nhập chữ ≥ 16px (kể cả khi cỡ chữ nhỏ) để Safari không tự phóng to', () => {
    expect(s).toMatch(/textarea \{[^}]*font-size: max\(16px, /);
  });
});

describe('cỡ chữ theo rem (Dynamic Type)', () => {
  it.each(css.map((f) => [f.slice(ROOT.length + 1), f]))('%s: không còn font-size cố định bằng px', (_, f) => {
    const bad = readFileSync(f, 'utf8')
      .split('\n')
      .filter((l) => /font-size:\s*[\d.]+px/.test(l) && !/:root\[data-fs=|^html \{/.test(l.trim()));
    expect(bad).toEqual([]);
  });
});
