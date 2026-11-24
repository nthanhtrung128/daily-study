import articles from '../../../content/reading/articles.json';

export const workTopics = articles.flatMap(article => article.weeklyFollowUp && article.turns
  ? [{ id: article.id, title: article.title.vi, lines: [...article.turns, article.weeklyFollowUp] }]
  : []);
export type WorkTopic = typeof workTopics[number];
export const workHref = (id: string) => '#hom-nay?tinh-huong=' + encodeURIComponent(id);
