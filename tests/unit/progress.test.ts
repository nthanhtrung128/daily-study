import { afterEach, describe, expect, it } from 'vitest';
import { StudyDB } from '../../src/core/db';
import { Progress } from '../../src/core/progress';

describe('Progress (IndexedDB)', () => {
  const store = new StudyDB('test-progress');
  afterEach(async () => {
    await store.delete();
    await store.open();
  });

  it('chấm điểm → lưu Leitner, nhật ký, thống kê ngày; tải lại được; tính chuỗi', async () => {
    let now = new Date(2026, 10, 2, 9);
    const p = new Progress(store, () => now);
    await p.load();
    p.grade('tr:K001', 2);
    now = new Date(2026, 10, 3, 21);
    p.grade('tr:K001', 0);
    p.grade('tr:Q001', 2);
    p.addSeconds(95);
    p.setNote('tr:M01', 'ý chính');
    await p.flush();

    const q = new Progress(store, () => now);
    await q.load();
    expect(q.stateOf('tr:K001')).toMatchObject({ box: 1, due: '2026-11-03', wrong: 1 });
    expect(q.stateOf('tr:Q001')).toMatchObject({ box: 1, due: '2026-11-04', wrong: 0 });
    expect(q.dayStat('2026-11-03')).toEqual({ day: '2026-11-03', n: 2, ok: 1, s: 95 });
    expect(q.streak()).toBe(2);
    expect(q.note('tr:M01')).toBe('ý chính');
    expect(await store.reviews.count()).toBe(3);
  });

  it('nâng cấp từ CSDL v1 (S1) giữ dữ liệu cũ', async () => {
    const { default: Dexie } = await import('dexie');
    const old = new Dexie('test-upgrade');
    old.version(1).stores({ items: 'id, box, due', reviews: '++id, itemId, day', settings: 'key' });
    await old.table('items').put({ id: 'tr:K009', box: 3, due: '2026-11-05', wrong: 0, last: 0 });
    old.close();
    const db2 = new StudyDB('test-upgrade');
    const p = new Progress(db2);
    await p.load();
    expect(p.stateOf('tr:K009')?.box).toBe(3);
    expect(db2.verno).toBe(2);
    await db2.delete();
  });
});
