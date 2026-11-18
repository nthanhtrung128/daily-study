import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db } from '../../core/db';
import type { Progress } from '../../core/progress';
import { ROADMAP_REVIEW_PREFIX, readReviewChoice } from '../../core/roadmapReview';
import { ITEM_BY_ID, trId, type TrItem } from './items';

const M05_CARDS: Readonly<Record<string, readonly string[]>> = {
  'trm-05-01': ['K031', 'K040', 'F03'],
  'trm-05-02': ['F08', 'F09'],
  'trm-05-03': ['K031', 'K117', 'F06'],
  'trm-05-04': ['K051', 'K052', 'K053'],
};
const relatedIds = new Set(Object.values(M05_CARDS).flat().map(trId));

export function relatedCardIds(lessonId: string): string[] {
  return (M05_CARDS[lessonId] ?? []).map(trId);
}

export function useRoadmapReview(p: Progress): TrItem[] | undefined {
  const [queue, setQueue] = useState<{ item: TrItem; at: number }[]>();
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const rows = await db.settings.where('key').startsWith(ROADMAP_REVIEW_PREFIX).toArray();
      return rows.flatMap((row) => {
        const id = row.key.slice(ROADMAP_REVIEW_PREFIX.length);
        const choice = readReviewChoice(row.value);
        const item = relatedIds.has(id) ? ITEM_BY_ID.get(id) : undefined;
        return choice?.queued && item ? [{ item, at: choice.at }] : [];
      }).sort((a, b) => a.at - b.at);
    }).subscribe({ next: setQueue, error: () => setQueue([]) });
    return () => subscription.unsubscribe();
  }, []);

  if (!p.loaded) return;
  return queue?.filter(({ item, at }) => (p.stateOf(item.id)?.last ?? 0) < at).map(({ item }) => item);
}
