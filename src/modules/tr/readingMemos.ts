import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import cases from '../../../content/reading/recall.json';
import { dayKey } from '../../core/date';
import { db, type Note } from '../../core/db';
import { ROADMAP_MODULES } from './roadmap';

const lessons = new Map(ROADMAP_MODULES.flatMap((module) =>
  module.lessons.map((lesson) => [lesson.id, { module, lesson }] as const),
));
const recallByLesson = new Map(Object.entries(cases).map(([article, practice]) => [practice.lesson, { article, practice }]));

export function recallMemoId(lessonId: string, variant: number, day: string) {
  return [lessonId, 'tu-nho', variant, day].join(':');
}

export function recallMemoLabel(variant: number, day: string) {
  return 'Tình huống ' + variant + ' · ' + day.split('-').reverse().join('/');
}

export function readingMemoSource(id: string) {
  const lessonMemo = lessons.get(id);
  if (lessonMemo) return { ...lessonMemo, recall: undefined };

  const match = /^([^:]+):tu-nho:([1-9]\d*):(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (!match) return;
  const [, lessonId = '', index, day = ''] = match;
  const source = lessons.get(lessonId);
  const entry = recallByLesson.get(lessonId);
  const variant = Number(index);
  if (!source || !entry?.practice.tasks[variant - 1] || dayKey(new Date(day + 'T12:00:00')) !== day) return;
  const href = '#doc-them?bai=' + entry.article + '&tu-nho=' + variant;
  return { ...source, recall: { label: recallMemoLabel(variant, day), href } };
}

type ReadingNote = Note & NonNullable<ReturnType<typeof readingMemoSource>>;

// Ghi chú thẻ và memo bài đọc cùng nằm trong bảng notes của bản sao lưu.
export function useReadingMemos() {
  const [notes, setNotes] = useState<ReadingNote[] | null>();
  useEffect(() => {
    const subscription = liveQuery(() => db.notes.where('id').startsWith('trm-').toArray()).subscribe({
      next: (rows) => setNotes(rows.flatMap((row) => {
        const source = readingMemoSource(row.id);
        return source ? [{ ...row, ...source }] : [];
      }).sort((a, b) => b.at - a.at)),
      error: () => setNotes(null),
    });
    return () => subscription.unsubscribe();
  }, []);
  return notes;
}

export type MemoState = ReturnType<typeof useReadingMemos>;
