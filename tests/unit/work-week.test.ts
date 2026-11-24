import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { StudyDB } from '../../src/core/db';
import { applyBackup, exportBackup, parseBackup } from '../../src/core/backup';
import { finishWorkTurn, openWorkTurn, weeklyChoiceKey, weeklyOpenPrefix, workReviews, workWeekSnapshot } from '../../src/core/workWeek';

it('giữ câu dở, ghi đúng một lượt, sang tuần đổi đề rồi quay về lượt kế tiếp', async () => {
  const store = new StudyDB('week-' + crypto.randomUUID());
  const id = 'giai-thich-thuong';
  const day = new Date('2026-11-24T10:00:00');
  try {
    const empty = parseBackup(await exportBackup(store));
    const [a, b] = await Promise.all([openWorkTurn(id, 4, '2026-11-24', store), openWorkTurn(id, 4, '2026-11-24', store)]);
    expect(a).toEqual(b);
    expect(a.index).toBe(0);
    await store.notes.put({ id: a.id, text: 'Hai phần của khoản thưởng.', at: day.getTime() });
    await Promise.all([1, 2].map(() => finishWorkTurn(id, a, 2, day.getTime() - 15000, day, store)));
    expect(await store.days.get('2026-11-24')).toMatchObject({ n: 1, ok: 1, sk: 15 });
    expect(await store.reviews.count()).toBe(1);
    const later = await openWorkTurn(id, 4, '2026-11-30', store);
    expect(later.index).toBe(3);
    const monday = new Date('2026-11-30T10:00:00');
    await finishWorkTurn(id, later, 1, monday.getTime(), monday, store);
    expect((await openWorkTurn(id, 4, '2026-12-01', store)).index).toBe(1);
    const backup = parseBackup(await exportBackup(store));
    await applyBackup(empty, 'replace', store);
    expect(await store.settings.get(weeklyOpenPrefix + id)).toBeUndefined();
    await applyBackup(backup, 'merge', store);
    await applyBackup(backup, 'merge', store);
    expect((await workReviews(id, 4, store)).map(r => r.index)).toEqual([3, 0]);
    expect((await store.notes.get(a.id))?.text).toBe('Hai phần của khoản thưởng.');
    expect((await store.settings.get(weeklyChoiceKey))?.value).toBe(id);
  } finally { await store.delete(); }
});

it('đối chiếu cùng tình huống, ưu tiên khác ngày, giữ memo và đúng bản ghi sau khôi phục', async () => {
  const store = new StudyDB('journal-' + crypto.randomUUID());
  const restored = new StudyDB('journal-restored-' + crypto.randomUUID());
  const topic = 'giai-thich-thuong';
  async function answer(day: string, hour: number, memo: string, name = topic) {
    const turn = await openWorkTurn(name, 4, day, store);
    const date = new Date(day + 'T' + hour + ':00:00');
    await store.notes.put({ id: turn.id, at: date.getTime(), text: memo });
    await finishWorkTurn(name, turn, 2, date.getTime(), date, store);
    return turn.id;
  }
  try {
    const monday = await answer('2026-11-23', 10, 'Nhắc lại mục tiêu.');
    await store.recordings.add({ topicId: monday, title: 'Thử câu đầu', at: 10, ms: 3000, mime: 'audio/mp4', data: new ArrayBuffer(3), size: 3 });
    await answer('2026-11-25', 10, 'Câu sáng.');
    const latest = await answer('2026-11-25', 16, 'Tách phần cá nhân.');
    await answer('2026-11-27', 11, 'Chủ đề khác.', 'chuyen-dau-gio');
    expect((await workWeekSnapshot(topic, 4, '2026-11-23', store)).entries.map(e => e.review.itemId)).toEqual([monday, latest]);
    expect(await workWeekSnapshot(topic, 4, '2026-11-30', store)).toEqual({ count: 0, entries: [] });
    const next = await answer('2026-12-01', 12, 'Trọng số mới.');
    expect((await workWeekSnapshot(topic, 4, '2026-11-30', store)).entries.map(e => e.review.itemId)).toEqual([latest, next]);
    await answer('2026-12-01', 16, 'Luyện lại buổi chiều.');
    expect((await workWeekSnapshot(topic, 4, '2026-11-30', store)).entries.map(e => e.review.day)).toEqual(['2026-12-01', '2026-12-01']);
    await store.notes.put({ id: 'en:weekly-reflection:' + topic + ':2026-11-23', text: 'Tôi đã giải thích cho quản lý.', at: 42 });
    const archive = parseBackup(await exportBackup(store, new Date(), { recordings: true }));
    await applyBackup(archive, 'replace', restored);
    const snapshot = await workWeekSnapshot(topic, 4, '2026-11-23', restored);
    expect(snapshot.count).toBe(3);
    expect(snapshot.entries.map(e => [e.memo, e.hasRecording])).toEqual([['Nhắc lại mục tiêu.', true], ['Tách phần cá nhân.', false]]);
    expect((await restored.notes.get('en:weekly-reflection:' + topic + ':2026-11-23'))?.text).toBe('Tôi đã giải thích cho quản lý.');
  } finally { await store.delete(); await restored.delete(); }
});
