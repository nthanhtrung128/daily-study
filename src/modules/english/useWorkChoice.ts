import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db } from '../../core/db';
import { weeklyChoiceKey } from '../../core/workWeek';

export function useWorkChoice() {
  const [choice, setChoice] = useState<string | null>();
  useEffect(() => {
    const subscription = liveQuery(() => db.settings.get(weeklyChoiceKey)).subscribe({
      next: row => setChoice(typeof row?.value === 'string' ? row.value : ''),
      error: () => setChoice(null),
    });
    return () => subscription.unsubscribe();
  }, []);
  return choice;
}
