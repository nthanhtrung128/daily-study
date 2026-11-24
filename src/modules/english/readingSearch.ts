import articles from '../../../content/reading/articles.json';
import { fold, matchesAll, queryTokens } from '../../core/fold';

export const readingRegions = ['Tất cả', 'Việt Nam', 'Quốc tế'] as const;
type Region = typeof readingRegions[number];
export type ReadingFilters = { query: string; region: Region };
export const allReadings: ReadingFilters = { query: '', region: 'Tất cả' };
const storageKey = 'ds.reading.filters';

const bilingual = (pair: { en: string; vi: string }) => pair.en + ' ' + pair.vi;
// Dùng ranh giới từ cả khi bản gốc có dấu phẩy hoặc gạch nối.
const words = (text: string) => ' ' + fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
const index = articles.map(article => ({
  article,
  fields: [
    [words(bilingual(article.title))],
    article.terms.map(term => words(bilingual(term))),
    [...article.paragraphs, article.question].map(pair => words(article.source.publisher + ' ' + bilingual(pair))),
  ],
}));

export function findReadings({ query, region }: ReadingFilters) {
  const tokens = queryTokens(words(query));
  if (query.trim() && !tokens.length) return [];
  // Khi đang gõ, từ cuối có thể chưa xong. Các từ trước phải khớp trọn trong cùng mục.
  const needles = tokens.map((word, i) => ' ' + word + (i === tokens.length - 1 ? '' : ' '));
  const matches = index.flatMap(({ article, fields }) => {
    if (region !== 'Tất cả' && article.region !== region) return [];
    const rank = fields.findIndex(group => group.some(text => matchesAll(text, needles)));
    return rank === -1 ? [] : [{ article, rank }];
  });
  return matches.sort((a, b) => a.rank - b.rank).map(entry => entry.article);
}

export function readReadingFilters(): ReadingFilters {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    const region = readingRegions.find(r => r === saved?.region) ?? allReadings.region;
    return { query: typeof saved?.query === 'string' ? saved.query : '', region };
  } catch { return allReadings; }
}

export function keepReadingFilters(filters: ReadingFilters) {
  try {
    if (filters.query || filters.region !== allReadings.region) sessionStorage.setItem(storageKey, JSON.stringify(filters));
    else sessionStorage.removeItem(storageKey);
  } catch { /* Bộ lọc vẫn dùng được trong React khi trình duyệt chặn lưu trữ. */ }
}
