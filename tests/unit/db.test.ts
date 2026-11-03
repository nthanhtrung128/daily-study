import { afterEach, describe, expect, it } from 'vitest';
import { StudyDB, getSetting, setSetting } from '../../src/core/db';

describe('StudyDB', () => {
  const store = new StudyDB('test-db');
  afterEach(async () => {
    await store.delete();
    await store.open();
  });

  it('đọc/ghi cài đặt', async () => {
    expect(await getSetting('mix', 0.4, store)).toBe(0.4);
    await setSetting('mix', 0.5, store);
    expect(await getSetting('mix', 0.4, store)).toBe(0.5);
  });

  it('lưu trạng thái Leitner và nhật ký ôn', async () => {
    await store.items.put({ id: 'tr:K001', box: 1, due: '2026-11-03', wrong: 0, last: 0 });
    await store.reviews.add({ itemId: 'tr:K001', day: '2026-11-03', grade: 2, at: 1 });
    expect(await store.items.where('due').belowOrEqual('2026-11-03').count()).toBe(1);
    expect(await store.reviews.where('day').equals('2026-11-03').count()).toBe(1);
  });
});
