import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { StudyDB } from '../../src/core/db';
import { applyBackup, exportBackup, parseBackup } from '../../src/core/backup';
import { finishWorkTurn, openWorkTurn, weeklyChoiceKey, weeklyOpenPrefix, workReviews } from '../../src/core/workWeek';

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
