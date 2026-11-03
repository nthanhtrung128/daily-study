import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE, ROUTES, parseHash, routeLabel } from '../../src/ui/routes';

describe('parseHash', () => {
  it('nhận đủ 4 trang', () => {
    expect(ROUTES.map((r) => r.id)).toEqual(['hom-nay', 'tra-cuu', 'tien-do', 'cai-dat']);
    for (const r of ROUTES) expect(parseHash(`#${r.id}`)).toBe(r.id);
  });

  it('hash rỗng hoặc lạ → Hôm nay', () => {
    expect(parseHash('')).toBe(DEFAULT_ROUTE);
    expect(parseHash('#')).toBe('hom-nay');
    expect(parseHash('#khong-co')).toBe('hom-nay');
  });

  it('chấp nhận dạng #/trang, tham số và chữ hoa', () => {
    expect(parseHash('#/tra-cuu')).toBe('tra-cuu');
    expect(parseHash('#tra-cuu?q=merit')).toBe('tra-cuu');
    expect(parseHash('#TIEN-DO')).toBe('tien-do');
  });

  it('nhãn tiếng Việt', () => {
    expect(routeLabel('cai-dat')).toBe('Cài đặt');
  });
});
