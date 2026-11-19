import { fold, matchesAll, queryTokens } from '../../core/fold';
import { ROADMAP_MODULES } from './roadmap';

const index = ROADMAP_MODULES.flatMap((module) =>
  module.lessons.map((lesson, position) => {
    const code = `${module.code}.${position + 1}`;
    const title = fold(`${code} ${lesson.title}`);
    const heading = `${title} ${fold(module.title)}`;
    const content = fold([lesson.context, lesson.explanation, ...lesson.steps, lesson.example,
      lesson.takeaway, lesson.review.question, lesson.review.answer].join(' '));
    return { code, module: module.title, lesson, title, heading, text: `${heading} ${content}` };
  }),
);

// Ưu tiên tiêu đề/mã bài, sau đó tên buổi. Cùng mức thì giữ nguyên thứ tự học.
export function searchRoadmap(query: string) {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const matches = index.filter((entry) => matchesAll(entry.text, tokens));
  const rank = (entry: typeof index[number]) => {
    if (matchesAll(entry.title, tokens)) return 0;
    if (matchesAll(entry.heading, tokens)) return 1;
    return 2;
  };
  return matches.sort((a, b) => rank(a) - rank(b));
}
