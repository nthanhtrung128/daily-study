import phrasesRaw from '../../../content/english/phrases.json';
import patternsRaw from '../../../content/english/patterns.json';
import { fold, matchesAll, queryTokens } from '../../core/fold';
import { DATA, baiOf, type Concept, type Formula, type Gloss, type OpenQ, type Quiz } from '../tr/data';
import { ITEM_BY_ID, titleOf, trId } from '../tr/items';

/**
 * Chỉ mục tra cứu: khái niệm, công thức, thuật ngữ Anh–Việt, câu hỏi mở, trắc nghiệm của TR101
 * và cụm từ / câu mẫu tiếng Anh. Id mỗi mục trùng id Leitner (tr:…, en:…) để chấm mức thuộc và ghi chú.
 */
export interface Phrase {
  id: string;
  en: string;
  vi: string;
  example?: string;
  note?: string;
  topic: string;
  level: string;
}
export interface Pattern {
  id: string;
  situation: string;
  en: string;
  vi: string;
  slots?: { text: string; alts: string[] }[];
  note?: string;
  topic: string;
  level: string;
}

export const PHRASES = (phrasesRaw as unknown as { items: Phrase[] }).items;
export const PATTERNS = (patternsRaw as unknown as { items: Pattern[] }).items;

/** Id Leitner cho mục tiếng Anh: "en:" + id trong content (ph-0001, pt-0001). */
export const enId = (raw: string) => `en:${raw}`;

export type LookupKind = 'concept' | 'formula' | 'term' | 'open' | 'quiz' | 'phrase' | 'pattern';

export type LookupDetail =
  | { kind: 'concept'; c: Concept }
  | { kind: 'formula'; f: Formula }
  | { kind: 'term'; g: Gloss }
  | { kind: 'open'; o: OpenQ }
  | { kind: 'quiz'; q: Quiz }
  | { kind: 'phrase'; p: Phrase }
  | { kind: 'pattern'; p: Pattern };

export interface LookupEntry {
  id: string;
  kind: LookupKind;
  bai: string[];
  title: string;
  sub: string;
  tag: string;
  /** Nội dung đã chuẩn hóa để tìm. */
  hay: string;
  /** Tiêu đề + dòng phụ đã chuẩn hóa, dùng để xếp hạng. */
  head: string;
  detail: LookupDetail;
}

export const KIND_LABEL: Record<LookupKind, string> = {
  concept: 'Khái niệm',
  formula: 'Công thức',
  term: 'Thuật ngữ',
  open: 'Câu hỏi mở',
  quiz: 'Trắc nghiệm',
  phrase: 'Cụm từ EN',
  pattern: 'Câu mẫu EN',
};
export const KINDS = Object.keys(KIND_LABEL) as LookupKind[];
/** Loại mục không gắn với buổi học TR101. */
export const NO_BAI: ReadonlySet<LookupKind> = new Set(['term', 'phrase', 'pattern']);

const TOPIC_LABEL: Record<string, string> = {
  office: 'Công sở',
  meetings: 'Họp',
  email: 'Email',
  'cb-hr': 'C&B / HR',
  interview: 'Phỏng vấn',
  negotiation: 'Thương lượng',
};
export const topicLabel = (t: string) => TOPIC_LABEL[t] ?? t;

function entry(e: Omit<LookupEntry, 'hay' | 'head'>, parts: unknown[]): LookupEntry {
  return { ...e, hay: fold(parts.join(' ')), head: fold(`${e.title} ${e.sub}`) };
}

export function buildIndex(): LookupEntry[] {
  const out: LookupEntry[] = [];
  for (const c of DATA.concepts) {
    out.push(entry({ id: trId(c.id), kind: 'concept', bai: baiOf(c.bai), title: c.vi, sub: c.en, tag: c.chude, detail: { kind: 'concept', c } }, [c.vi, c.en, c.dn, c.ct, c.vd, c.kw, c.chude]));
  }
  for (const f of DATA.formulas) {
    out.push(entry({ id: trId(f.id), kind: 'formula', bai: baiOf(f.bai), title: f.name, sub: f.f, tag: `Buổi ${f.bai}`, detail: { kind: 'formula', f } }, [f.name, f.f, f.ex]));
  }
  for (const g of DATA.gloss) {
    const id = trId(`G${String(g.n).padStart(3, '0')}`);
    out.push(entry({ id, kind: 'term', bai: [], title: g.en, sub: g.vi, tag: `#${g.n}`, detail: { kind: 'term', g } }, [g.en, g.vi, g.note]));
  }
  for (const o of DATA.openq) {
    out.push(entry({ id: trId(o.id), kind: 'open', bai: baiOf(o.bai), title: o.q, sub: '', tag: o.id, detail: { kind: 'open', o } }, [o.q, o.hint, o.grp]));
  }
  for (const q of DATA.quiz) {
    out.push(entry({ id: trId(q.id), kind: 'quiz', bai: baiOf(q.bai), title: q.q, sub: '', tag: q.id, detail: { kind: 'quiz', q } }, [q.q, ...q.o, q.ex]));
  }
  for (const p of PHRASES) {
    out.push(entry({ id: enId(p.id), kind: 'phrase', bai: [], title: p.en, sub: p.vi, tag: `EN · ${topicLabel(p.topic)}`, detail: { kind: 'phrase', p } }, [p.en, p.vi, p.example, p.note, p.topic, topicLabel(p.topic)]));
  }
  for (const p of PATTERNS) {
    const alts = (p.slots ?? []).flatMap((s) => s.alts);
    out.push(entry({ id: enId(p.id), kind: 'pattern', bai: [], title: p.en, sub: p.vi, tag: `EN · ${topicLabel(p.topic)}`, detail: { kind: 'pattern', p } }, [p.en, p.vi, p.situation, p.note, ...alts, p.topic, topicLabel(p.topic)]));
  }
  return out;
}

let cache: LookupEntry[] | null = null;
let byId: Map<string, LookupEntry> | null = null;
export function lookupIndex(): LookupEntry[] {
  cache ??= buildIndex();
  return cache;
}
export function entryById(id: string): LookupEntry | undefined {
  byId ??= new Map(lookupIndex().map((e) => [e.id, e]));
  return byId.get(id);
}

export interface LookupQuery {
  q: string;
  /** '' = mọi loại. */
  kind: LookupKind | '';
  /** '' = mọi buổi. Chỉ áp cho mục TR có buổi học. */
  bai: string;
}

/**
 * Lọc theo loại, buổi, từ khóa (không dấu / có dấu, nhiều từ = phải có đủ).
 * Có từ khóa thì xếp mục khớp ở tiêu đề lên trước.
 */
export function search(index: readonly LookupEntry[], { q, kind, bai }: LookupQuery): LookupEntry[] {
  const tokens = queryTokens(q);
  const whole = tokens.join(' ');
  const rows = index.filter(
    (e) => (!kind || e.kind === kind) && (!bai || (!NO_BAI.has(e.kind) && e.bai.includes(bai))) && matchesAll(e.hay, tokens),
  );
  if (!tokens.length) return rows;
  const rank = (e: LookupEntry) =>
    e.head.startsWith(whole) ? 0 : e.head.includes(whole) ? 1 : matchesAll(e.head, tokens) ? 2 : 3;
  return rows
    .map((e, i) => ({ e, i, r: rank(e) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.e);
}

/** Tên hiển thị của một id tiến độ (danh sách hay sai). */
export function titleOfId(id: string): string {
  const it = ITEM_BY_ID.get(id);
  if (it) return titleOf(it);
  return entryById(id)?.title ?? id.replace(/^(tr|en):/, '');
}
