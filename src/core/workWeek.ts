import { db, type ReviewLog, type StudyDB } from './db';
import { addDays, dayKey } from './date';
import { addStudy, lapSecs, weekStart } from './studytime';

export const weeklyChoiceKey = 'en.weekly.topic';
export const weeklyOpenPrefix = 'en.weekly.open.';
export const turnPrefix = (topic: string) => 'en:weekly:' + topic + ':';
export type WorkTurn = { id: string; index: number };
type WorkReview = ReviewLog & { index: number };

function decodeTurn(topic: string, id: unknown, length: number): WorkTurn | undefined {
  const prefix = turnPrefix(topic);
  if (typeof id !== 'string' || !id.startsWith(prefix)) return;
  const match = /^(\d+):([\da-f-]{36})$/.exec(id.slice(prefix.length));
  if (!match || Number(match[1]) >= length) return;
  return { id, index: Number(match[1]) };
}

export async function workReviews(topic: string, length: number, store = db): Promise<WorkReview[]> {
  const rows = await store.reviews.where('itemId').startsWith(turnPrefix(topic)).toArray();
  return rows.flatMap(row => {
    const turn = decodeTurn(topic, row.itemId, length);
    return turn ? [{ ...row, index: turn.index }] : [];
  }).sort((a, b) => b.at - a.at || (b.id ?? 0) - (a.id ?? 0));
}

export interface WorkWeekEntry {
  review: WorkReview;
  memo: string | undefined;
  hasRecording: boolean;
}

export async function workWeekSnapshot(topic: string, length: number, start: string, store = db) {
  const end = addDays(start, 6);
  return store.transaction('r', store.reviews, store.notes, store.recordings, async () => {
    const history = await workReviews(topic, length, store);
    const inWeek = history.filter(row => row.day >= start && row.day <= end);
    const latest = inWeek[0];
    const entries: WorkWeekEntry[] = [];
    if (latest) {
      const others = inWeek.filter(row => row.itemId !== latest.itemId);
      const previous = others.find(row => row.day !== latest.day) ?? others[0]
        ?? history.find(row => row.day < start && row.itemId !== latest.itemId);
      for (const review of previous ? [previous, latest] : [latest]) {
        const [note, recordings] = await Promise.all([
          store.notes.get(review.itemId), store.recordings.where('topicId').equals(review.itemId).count(),
        ]);
        entries.push({ review, memo: note?.text, hasRecording: recordings > 0 });
      }
    }
    return { count: inWeek.length, entries };
  });
}

export async function openWorkTurn(topic: string, length: number, today = dayKey(), store: StudyDB = db): Promise<WorkTurn> {
  const key = weeklyOpenPrefix + topic;
  return store.transaction('rw', store.settings, store.reviews, async () => {
    await store.settings.put({ key: weeklyChoiceKey, value: topic });
    const open = decodeTurn(topic, (await store.settings.get(key))?.value, length);
    if (open && !await store.reviews.where('itemId').equals(open.id).count()) return open;
    const history = await workReviews(topic, length, store);
    const last = history[0];
    const followUp = length - 1;
    const newWeek = last && weekStart(last.day) < weekStart(today);
    const index = last && last.index !== followUp && (newWeek || last.index === followUp - 1)
      ? followUp : ((history.find(r => r.index < followUp)?.index ?? -1) + 1) % followUp;
    const id = turnPrefix(topic) + index + ':' + crypto.randomUUID();
    await store.settings.put({ key, value: id });
    return { id, index };
  });
}

export async function finishWorkTurn(topic: string, turn: WorkTurn, grade: 1 | 2, openedAt: number, now = new Date(), store = db) {
  const key = weeklyOpenPrefix + topic;
  const at = now.getTime();
  const day = dayKey(now);
  return store.transaction('rw', store.settings, store.reviews, store.days, async () => {
    if ((await store.settings.get(key))?.value !== turn.id) {
      const saved = await store.reviews.where('itemId').equals(turn.id).first();
      if (saved) return saved.grade;
      throw new Error('Lượt đang mở đã thay đổi.');
    }
    await store.reviews.add({ itemId: turn.id, day, at, grade });
    const current = await store.days.get(day) ?? { day, n: 0, ok: 0, s: 0 };
    const next = addStudy(current, 'speak', lapSecs(openedAt, at));
    await store.days.put({ ...next, n: next.n + 1, ok: next.ok + Number(grade === 2) });
    await store.settings.delete(key);
    return grade;
  });
}
