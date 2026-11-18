import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import module05 from '../../../content/tr-roadmap/m05.json';
import module06 from '../../../content/tr-roadmap/m06.json';
import module09 from '../../../content/tr-roadmap/m09.json';
import { db, setSetting } from '../../core/db';

export const ROADMAP_MODULES = [module05, module06, module09];
export type RoadmapLesson = typeof module05.lessons[number];
export { module06, module09 };

const prefix = 'tr.roadmap.';

export function useRoadmapProgress() {
  const [completed, setCompleted] = useState<string[]>();

  useEffect(() => {
    const subscription = liveQuery(() => db.settings.where('key').startsWith(prefix).toArray()).subscribe({
      next: (rows) => setCompleted(rows.filter((row) => row.value === true).map((row) => row.key.slice(prefix.length))),
      error: () => setCompleted(undefined),
    });
    return () => subscription.unsubscribe();
  }, []);

  return completed;
}

export function completeLesson(id: string) {
  return setSetting(prefix + id, true);
}
