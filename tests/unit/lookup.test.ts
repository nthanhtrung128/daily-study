import { describe, expect, it } from 'vitest';
import { fold, queryTokens } from '../../src/core/fold';
import { KINDS, entryById, lookupIndex, search, titleOfId } from '../../src/modules/lookup';
import { DATA } from '../../src/modules/tr/data';

const idx = lookupIndex();
const find = (q: string, kind: Parameters<typeof search>[1]['kind'] = '', bai = '') => search(idx, { q, kind, bai });

describe('fold (tìm không dấu)', () => {
  it('bỏ dấu, đ → d, chữ thường, gộp khoảng trắng', () => {
    expect(fold('  Phụ CẤP   Đi lại ')).toBe('phu cap di lai');
    expect(fold('Lương 3P')).toBe('luong 3p');
    expect(fold(null)).toBe('');
    // Tổ hợp dấu rời (NFD) cũng chuẩn hóa như dựng sẵn (NFC).
    expect(fold('Thành')).toBe(fold('Thành'));
    expect(queryTokens('  compa  ratio ')).toEqual(['compa', 'ratio']);
  });
});

describe('chỉ mục tra cứu', () => {
  it('đủ mọi loại, id trùng id Leitner và không trùng nhau', () => {
    const kinds = new Set(idx.map((e) => e.kind));
    expect([...kinds].sort()).toEqual([...KINDS].sort());
    expect(idx.filter((e) => e.kind === 'concept')).toHaveLength(DATA.concepts.length);
    expect(idx.filter((e) => e.kind === 'term')).toHaveLength(DATA.gloss.length);
    expect(new Set(idx.map((e) => e.id)).size).toBe(idx.length);
    expect(entryById('tr:K001')?.title).toBe(DATA.concepts[0]?.vi);
    expect(entryById('en:ph-0001')?.kind).toBe('phrase');
  });

  it('có dấu và không dấu cho cùng kết quả', () => {
    const a = find('tổng đãi ngộ').map((e) => e.id);
    const b = find('tong dai ngo').map((e) => e.id);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
    expect(a).toContain('tr:K001');
  });

  it('nhiều từ: phải có đủ mọi từ; khớp tiêu đề xếp trước', () => {
    const rows = find('compa ratio');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.hay).toContain('compa');
    expect(rows[0]?.head).toMatch(/compa/);
    expect(find('compa zzzzqx')).toHaveLength(0);
  });

  it('lọc theo loại và buổi', () => {
    const f = find('', 'formula');
    expect(f).toHaveLength(DATA.formulas.length);
    const b2 = find('', '', '2');
    expect(b2.length).toBeGreaterThan(0);
    expect(b2.every((e) => e.bai.includes('2'))).toBe(true);
    // Lọc buổi không áp cho thuật ngữ / tiếng Anh.
    expect(b2.some((e) => e.kind === 'term' || e.kind === 'phrase')).toBe(false);
    expect(find('', 'quiz', 'Bổ sung').every((e) => e.kind === 'quiz' && e.bai.includes('Bổ sung'))).toBe(true);
  });

  it('tìm được thuật ngữ Anh–Việt theo nghĩa tiếng Việt và cụm từ tiếng Anh', () => {
    const t = find('trach nhiem', 'term');
    expect(t.some((e) => e.title === 'Accountability Pay')).toBe(true);
    expect(find('touch base').some((e) => e.id === 'en:ph-0001')).toBe(true);
    expect(find('lien lac nhanh', 'phrase').some((e) => e.id === 'en:ph-0001')).toBe(true);
  });

  it('tên mục theo id tiến độ', () => {
    expect(titleOfId('tr:C-mid')).toBe('Bài tính: Midpoint');
    expect(titleOfId('en:ph-0001')).toBe('touch base');
    expect(titleOfId('tr:XYZ')).toBe('XYZ');
  });
});
