import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { applyBackup, exportBackup, parseBackup } from '../../src/core/backup';
import { StudyDB } from '../../src/core/db';
import { advanceConversation, conversationPrefix, readConversation, saveConversation } from '../../src/core/readingConversation';

it('luyện từng câu còn vướng một lần, giữ câu đã đạt và khôi phục đúng câu giữa vòng', async () => {
  const db = new StudyDB('retry-reading-' + crypto.randomUUID());
  const id = 'thu-du-toan';
  const key = conversationPrefix + id;
  const saved = async () => readConversation((await db.settings.get(key))?.value)!;
  try {
    // Bản cũ đã chấm cả ba câu, chỉ câu giữa đạt.
    await db.settings.put({ key, value: { at: 10, scores: [false, true, false] } });
    expect(await saveConversation(id, 10, 'retry', db)).toBe(true);
    const first = await saved();
    expect(first.retryIndex).toBe(0);
    expect(await saveConversation(id, first.at, false, db)).toBe(true);
    const last = await saved();
    expect(last.retryIndex).toBe(2);
    expect(await saveConversation(id, first.at, true, db)).toBe(false);
    const backup = parseBackup(await exportBackup(db));
    await db.settings.delete(key);
    await applyBackup(backup, 'merge', db);
    expect(await saved()).toEqual(last);
    await saveConversation(id, last.at, true, db);
    const result = await saved();
    expect(result.scores).toEqual([false, true, true]);
    expect(result.retryIndex).toBeUndefined();
    const again = advanceConversation(result, 'retry')!;
    expect(again.retryIndex).toBe(0);
    expect(advanceConversation(again, true)?.scores).toEqual([true, true, true]);
    expect(advanceConversation({ at: 1, scores: [true, true, true] }, 'retry')).toBeUndefined();
    expect(advanceConversation({ at: 1, scores: [false] }, 'retry')).toBeUndefined();
    expect(readConversation({ at: 10, scores: [false, true, false], retryIndex: 1 })).toEqual({ at: 10, scores: [false, true, false] });
  } finally { await db.delete(); }
});

it('hai cửa sổ cùng chấm một câu chỉ lưu một điểm, mỗi bài giữ kết quả riêng', async () => {
  const db = new StudyDB('reading-' + crypto.randomUUID());
  const id = 'thu-du-toan';
  const saved = async () => readConversation((await db.settings.get(conversationPrefix + id))?.value)!;
  try {
    const commits = await Promise.all([true, false].map(mark => saveConversation(id, 0, mark, db)));
    expect(commits.filter(Boolean)).toHaveLength(1);
    const first = await saved();
    expect(first.scores).toEqual([commits[0]]);
    await saveConversation('doi-chieu-tien-an-ca', 0, false, db);
    expect(await saveConversation(id, first.at, true, db)).toBe(true);
    expect(await saveConversation(id, first.at, false, db)).toBe(false);
    expect((await saved()).scores).toEqual([...first.scores, true]);
    expect((await db.settings.get(conversationPrefix + 'doi-chieu-tien-an-ca'))?.value).toMatchObject({ scores: [false] });
    expect(await db.reviews.count()).toBe(0);
  } finally { await db.delete(); }
});

it('gộp giữ lượt chấm hoặc lần luyện lại mới nhất, thay bằng bản cũ xóa đúng tiến độ hội thoại', async () => {
  const db = new StudyDB('reading-backup-' + crypto.randomUUID());
  const id = 'trao-doi-xet-lai-ngach';
  const key = conversationPrefix + id;
  const saved = async () => readConversation((await db.settings.get(key))?.value);
  try {
    const old = parseBackup(await exportBackup(db));
    let at = 0;
    for (const grade of [false, true, true]) {
      await saveConversation(id, at, grade, db);
      at = (await saved())!.at;
    }
    expect(await saveConversation(id, at, true, db)).toBe(false);
    const complete = parseBackup(await exportBackup(db));
    await saveConversation(id, at, 'restart', db);
    const restarted = parseBackup(await exportBackup(db));
    await applyBackup(complete, 'merge', db);
    expect((await saved())?.scores).toEqual([]);
    await applyBackup(old, 'replace', db);
    expect(await saved()).toBeUndefined();
    await applyBackup(complete, 'merge', db);
    expect((await saved())?.scores).toEqual([false, true, true]);
    await applyBackup(restarted, 'merge', db);
    expect((await saved())?.scores).toEqual([]);
    const invalid = parseBackup({ ...await exportBackup(db), settings: [{ key, value: { scores: ['true'], at: 1 } }] });
    expect(invalid.settings).toEqual([]);
    expect(invalid.skipped).toBe(1);
  } finally { await db.delete(); }
});
