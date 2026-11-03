import { describe, expect, it } from 'vitest';
import headersText from '../../public/_headers?raw';
import { headersForPath, parseHeadersFile } from '../../scripts/cf-headers';

const real = parseHeadersFile(headersText);

describe('parseHeadersFile / headersForPath', () => {
  it('đọc quy tắc, khớp *, nối giá trị trùng, bỏ bằng "!"', () => {
    const rules = parseHeadersFile(
      ['# chú thích', '/*', '  X-A: 1', '  X-B: b', '/assets/*', '  X-A: 2', '  ! X-B', '/u/:id', '  X-C: c'].join('\n'),
    );
    expect(rules).toHaveLength(3);
    expect(headersForPath(rules, '/')).toEqual({ 'x-a': '1', 'x-b': 'b' });
    expect(headersForPath(rules, '/assets/a.js')).toEqual({ 'x-a': '1, 2' });
    expect(headersForPath(rules, '/u/7')).toMatchObject({ 'x-c': 'c' });
    expect(headersForPath(rules, '/u/7/x')).not.toHaveProperty('x-c');
  });

  it('báo lỗi dòng header không thuộc đường dẫn nào', () => {
    expect(() => parseHeadersFile('  X-A: 1')).toThrow();
  });
});

describe('public/_headers', () => {
  const csp = (p: string) => headersForPath(real, p)['content-security-policy'] ?? '';

  it('mọi đường dẫn có CSP chặt và header bảo mật', () => {
    for (const p of ['/', '/index.html', '/sw.js', '/assets/index-abc.js', '/icons/icon-192.png']) {
      const h = headersForPath(real, p);
      expect(csp(p)).toContain("script-src 'self';");
      expect(csp(p)).not.toMatch(/unsafe-(inline|eval)|https?:/);
      expect(h['permissions-policy']).toContain('microphone=(self)');
      expect(h['referrer-policy']).toBe('no-referrer');
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['x-robots-tag']).toContain('noindex');
    }
  });

  it('cache: asset có hash immutable; index/sw/manifest no-cache; mỗi đường dẫn chỉ một Cache-Control', () => {
    expect(headersForPath(real, '/assets/index-abc.js')['cache-control']).toBe('public, max-age=31536000, immutable');
    for (const p of ['/', '/index.html', '/sw.js', '/manifest.webmanifest']) {
      expect(headersForPath(real, p)['cache-control']).toBe('no-cache');
    }
    expect(headersForPath(real, '/icons/icon-192.png')['cache-control']).toBeUndefined();
  });
});
