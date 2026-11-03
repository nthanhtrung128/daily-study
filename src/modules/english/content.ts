import phrasesRaw from '../../../content/english/phrases.json';
import patternsRaw from '../../../content/english/patterns.json';

/**
 * Nội dung tiếng Anh (S4) — import thẳng JSON trong content/english/ (đã kiểm schema bằng validate:content).
 * Id lưu tiến độ có tiền tố "en:" để dùng chung bảng Leitner với TR mà không đụng nhau: "en:ph-0001", "en:pt-0001".
 */
export type Topic = 'office' | 'meetings' | 'email' | 'cb-hr' | 'interview' | 'negotiation';
export type Level = 'B1' | 'B2' | 'C1';

export interface Phrase {
  id: string;
  en: string;
  vi: string;
  example: string;
  topic: Topic;
  level: Level;
  ipa?: string;
  note?: string;
}

export interface Slot {
  /** Đoạn xuất hiện nguyên văn trong câu, là chỗ được thay. */
  text: string;
  alts: string[];
}

export interface Pattern {
  id: string;
  situation: string;
  en: string;
  vi: string;
  slots: Slot[];
  topic: Topic;
  level: Level;
  note?: string;
}

export const PHRASES = (phrasesRaw as { items: Phrase[] }).items;
export const PATTERNS = (patternsRaw as { items: Pattern[] }).items;

export const TOPIC_VI: Record<Topic, string> = {
  office: 'Công sở',
  meetings: 'Họp',
  email: 'Email',
  'cb-hr': 'C&B / HR',
  interview: 'Phỏng vấn',
  negotiation: 'Thương lượng',
};
export const TOPICS = Object.keys(TOPIC_VI) as Topic[];

export type EnItem = { id: string; type: 'phrase'; ph: Phrase } | { id: string; type: 'pattern'; pt: Pattern };
export type EnType = EnItem['type'];

export const enId = (contentId: string): string => `en:${contentId}`;

export const EN_ITEMS: readonly EnItem[] = [
  ...PHRASES.map((ph): EnItem => ({ id: enId(ph.id), type: 'phrase', ph })),
  ...PATTERNS.map((pt): EnItem => ({ id: enId(pt.id), type: 'pattern', pt })),
];

export function titleOfEn(it: EnItem): string {
  return it.type === 'phrase' ? it.ph.en : it.pt.en;
}
