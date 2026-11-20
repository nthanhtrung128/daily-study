import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db } from '../../core/db';
import type { Progress } from '../../core/progress';
import { ROADMAP_REVIEW_PREFIX, readReviewChoice } from '../../core/roadmapReview';
import { ITEM_BY_ID, trId, type TrItem } from './items';

const LESSON_CARDS: Readonly<Record<string, readonly string[]>> = {
  'trm-01-01': ['K003', 'K020'],
  'trm-01-02': ['K002', 'K019'],
  'trm-01-03': ['K021', 'G038'],
  'trm-01-04': ['K027', 'G309'],
  'trm-02-01': ['K159', 'K161'],
  'trm-02-02': ['G212', 'K157'],
  'trm-02-03': ['G212', 'F18'],
  'trm-02-04': ['G212', 'G281'],
  'trm-03-01': ['G205', 'G096'],
  'trm-03-02': ['G316', 'G096'],
  'trm-03-03': ['K109', 'K054'],
  'trm-03-04': ['K155', 'G281'],
  'trm-04-01': ['K082', 'K088'],
  'trm-04-02': ['K057', 'K096'],
  'trm-04-03': ['K086', 'K029'],
  'trm-04-04': ['K101', 'K098'],
  'trm-04-05': ['K058', 'K100'],
  'trm-05-01': ['K031', 'K040', 'F03'],
  'trm-05-02': ['F08', 'F09'],
  'trm-05-03': ['K031', 'K117', 'F06'],
  'trm-05-04': ['K051', 'K052', 'K053'],
  'trm-06-01': ['K131', 'K133'],
  'trm-06-02': ['K136', 'K113'],
  'trm-06-03': ['K111', 'F16'],
  'trm-06-04': ['K135', 'K134'],
  'trm-07-01': ['K044', 'G273'],
  'trm-07-02': ['K066', 'K067'],
  'trm-07-03': ['K069', 'F12'],
  'trm-07-04': ['K068', 'K143'],
  'trm-08-01': ['K092', 'G131'],
  'trm-08-02': ['K091', 'K086'],
  'trm-08-03': ['K120', 'F17'],
  'trm-08-04': ['K049', 'F10'],
  'trm-09-01': ['G316', 'G203'],
  'trm-09-02': ['K047', 'F08'],
  'trm-09-03': ['F11', 'K055'],
  'trm-09-04': ['F10', 'G316'],
  'trm-10-01': ['G253', 'G337'],
  'trm-10-02': ['G150', 'G035'],
  'trm-10-03': ['G237'],
  'trm-10-04': ['G253', 'G341'],
  'trm-11-01': ['K028', 'K020'],
  'trm-11-02': ['G237', 'K017'],
  'trm-11-03': ['K148', 'K150'],
  'trm-11-04': ['K149', 'K155'],
  'trm-12-01': ['K126', 'G146'],
  'trm-12-02': ['G163', 'G233'],
  'trm-12-03': ['G019', 'G152'],
  'trm-12-04': ['G316', 'G146'],
  'trm-13-01': ['K006', 'G083'],
  'trm-13-02': ['K009', 'K011'],
  'trm-13-03': ['K013', 'G064'],
  'trm-13-04': ['G296', 'G334'],
  'trm-14-01': ['G028', 'G050'],
  'trm-14-02': ['K016', 'G295'],
  'trm-14-03': ['K102', 'G221'],
  'trm-14-04': ['G267', 'G027'],
  'trm-15-01': ['K064', 'K074'],
  'trm-15-02': ['G224', 'K072'],
  'trm-15-03': ['K078', 'F13'],
  'trm-15-04': ['K079', 'K068'],
  'trm-16-01': ['K046', 'G277'],
  'trm-16-02': ['G218', 'K068'],
  'trm-16-03': ['G041', 'G303'],
  'trm-16-04': ['G219', 'G210'],
  'trm-17-01': ['G059', 'G218'],
  'trm-17-02': ['G265', 'G219'],
  'trm-17-03': ['G057', 'G298'],
  'trm-17-04': ['K081', 'G242'],
};
const relatedIds = new Set(Object.values(LESSON_CARDS).flat().map(trId));

export function relatedCardIds(lessonId: string): string[] {
  return (LESSON_CARDS[lessonId] ?? []).map(trId);
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
