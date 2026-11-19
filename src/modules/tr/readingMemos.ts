import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db, type Note } from '../../core/db';
import { ROADMAP_MODULES } from './roadmap';

export const memoLessons = new Map(ROADMAP_MODULES.flatMap((module) =>
  module.lessons.map((lesson) => [lesson.id, { module, lesson }] as const),
));

// Ghi chú thẻ và memo bài đọc cùng nằm trong bảng notes của bản sao lưu.
export function useReadingMemos() {
  const [notes, setNotes] = useState<Note[] | null>();
  useEffect(() => {
    const subscription = liveQuery(() => db.notes.where('id').startsWith('trm-').toArray()).subscribe({
      next: (rows) => setNotes(rows.filter((row) => memoLessons.has(row.id)).sort((a, b) => b.at - a.at)),
      error: () => setNotes(null),
    });
    return () => subscription.unsubscribe();
  }, []);
  return notes;
}

export type MemoState = ReturnType<typeof useReadingMemos>;
