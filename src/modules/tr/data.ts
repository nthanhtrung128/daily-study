import raw from '../../../content/tr101/data.json';

/** Dữ liệu TR101 (nội bộ) — import thẳng content/tr101/data.json, không sửa file gốc. */
export interface Concept {
  id: string;
  bai: string;
  chude: string;
  vi: string;
  en: string;
  dn: string;
  ct: string;
  vd: string;
  src: string;
  kw: string;
}
export interface Gloss {
  n: number;
  en: string;
  vi: string;
  note: string;
}
export interface Quiz {
  id: string;
  bai: string;
  q: string;
  o: string[];
  a: number;
  ex: string;
}
export interface OpenQ {
  id: string;
  grp: string;
  q: string;
  hint: string;
  bai: string;
}
export interface Formula {
  id: string;
  name: string;
  f: string;
  ex: string;
  bai: string;
}
export interface TrData {
  meta: { title: string; asof: string; bai: Record<string, string> };
  concepts: Concept[];
  gloss: Gloss[];
  quiz: Quiz[];
  openq: OpenQ[];
  formulas: Formula[];
}

export const DATA = raw as unknown as TrData;

/** Thứ tự và nhãn buổi học như bản cũ. */
export const BAI_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8-9', '10', 'Bổ sung'] as const;
export const BAI_SHORT: Record<string, string> = {
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8-9': '8–9', '10': '10',
  'Bổ sung': 'Pháp lý VN', 'Đọc thêm': 'Đọc thêm',
};

/** Chuẩn hóa trường "bai" ("2–3", "3, 6", "8", "Bổ sung"…) thành danh sách khóa buổi. */
export function baiOf(v: unknown): string[] {
  const s = String(v ?? '');
  if (s.includes('Bổ sung')) return ['Bổ sung'];
  if (s.includes('Đọc thêm')) return ['Đọc thêm'];
  if (s === '8-9') return ['8-9'];
  const out: string[] = [];
  for (const m of s.matchAll(/\d+/g)) {
    const n = m[0];
    out.push(n === '8' || n === '9' ? '8-9' : n);
  }
  return out.length ? [...new Set(out)] : ['Đọc thêm'];
}

export function baiLabel(keys: readonly string[]): string {
  return keys
    .map((x) => (x === 'Bổ sung' ? 'Pháp lý VN [Bổ sung]' : x === 'Đọc thêm' ? 'Bài đọc thêm' : `Buổi ${BAI_SHORT[x] ?? x}`))
    .join(' · ');
}
