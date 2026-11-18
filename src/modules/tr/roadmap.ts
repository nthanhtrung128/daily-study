import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import module05 from '../../../content/tr-roadmap/m05.json';
import { db, setSetting } from '../../core/db';

export { module05 };

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
