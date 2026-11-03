import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { StudyDB, isQuotaError } from '../../src/core/db';
import { Progress } from '../../src/core/progress';
import { exportBackup } from '../../src/core/backup';
import { listRecordings, saveRecording } from '../../src/modules/english/speech/recordings';

/**
 * Nâng version Dexie từ dữ liệu cũ: tạo DB đúng như bản S1 (v1) / S2 (v2) bằng fake-indexeddb,
 * ghi dữ liệu, đóng lại rồi mở bằng code hiện tại (v3). Dữ liệu cũ phải còn nguyên, bảng mới dùng được.
 */
const NAME = 'upgrade-test';

async function makeV1() {
  const old = new Dexie(NAME);
  old.version(1).stores({ items: 'id, box, due', reviews: '++id, itemId, day', settings: 'key' });
  await old.open();
  await old.table('items').bulkPut([
    { id: 'tr:K001', box: 4, due: '2026-11-10', wrong: 1, last: 1_700_000_000_000 },
    { id: 'en:ph:0001', box: 1, due: '2026-11-03', wrong: 2, last: 1_700_000_100_000 },
  ]);
  await old.table('reviews').bulkAdd([
    { itemId: 'tr:K001', day: '2026-11-01', grade: 2, at: 1 },
    { itemId: 'en:ph:0001', day: '2026-11-02', grade: 0, at: 2 },
  ]);
  await old.table('settings').put({ key: 'tr.prefs', value: { min: 10, mode: 'quiz', bai: [] } });
  old.close();
}

async function makeV2() {
  const old = new Dexie(NAME);
  old.version(1).stores({ items: 'id, box, due', reviews: '++id, itemId, day', settings: 'key' });
  old.version(2).stores({ days: 'day', notes: 'id' });
  await old.open();
  await old.table('items').put({ id: 'tr:Q010', box: 2, due: '2026-11-05', wrong: 0, last: 5 });
  await old.table('days').put({ day: '2026-11-02', n: 12, ok: 9, s: 600 });
  await old.table('notes').put({ id: 'tr:K001', text: 'ghi chú cũ', at: 3 });
  old.close();
}

describe('nâng cấp IndexedDB từ bản cũ', () => {
  afterEach(async () => {
    await Dexie.delete(NAME);
  });

  it('v1 (S1) → v3: giữ items, reviews, settings; thêm days, notes, recordings dùng được', async () => {
    await makeV1();
    const db = new StudyDB(NAME);
    await db.open();
    expect(db.verno).toBe(3);
    expect(await db.items.count()).toBe(2);
    expect(await db.items.get('tr:K001')).toMatchObject({ box: 4, due: '2026-11-10', wrong: 1 });
    expect(await db.items.where('due').belowOrEqual('2026-11-03').count()).toBe(1);
    expect(await db.reviews.where('day').equals('2026-11-02').count()).toBe(1);
    expect((await db.settings.get('tr.prefs'))?.value).toMatchObject({ mode: 'quiz' });

    await db.days.put({ day: '2026-11-03', n: 1, ok: 1, s: 30 });
    await db.notes.put({ id: 'tr:K001', text: 'mới', at: 1 });
    await saveRecording({ topicId: 'st-0001', title: 'Tell me about yourself', blob: new Blob([new Uint8Array(10)], { type: 'audio/mp4' }), ms: 1200 }, db);
    expect(await listRecordings('st-0001', db)).toHaveLength(1);

    // Progress đọc được dữ liệu cũ (bản cũ chưa có bảng days: chuỗi ngày bắt đầu từ 0, không lỗi).
    const p = new Progress(db, () => new Date(2026, 10, 3, 9));
    await p.load();
    expect(p.problem).toBeNull();
    expect(p.stateOf('en:ph:0001')).toMatchObject({ box: 1, wrong: 2 });
    expect(p.note('tr:K001')).toBe('mới');
    db.close();
  });

  it('v2 (S2) → v3: giữ thống kê ngày và ghi chú; sao lưu xuất được đủ', async () => {
    await makeV2();
    const db = new StudyDB(NAME);
    await db.open();
    expect(db.verno).toBe(3);
    expect(await db.days.get('2026-11-02')).toEqual({ day: '2026-11-02', n: 12, ok: 9, s: 600 });
    expect((await db.notes.get('tr:K001'))?.text).toBe('ghi chú cũ');
    expect(await db.recordings.count()).toBe(0);
    const backup = await exportBackup(db);
    expect(JSON.stringify(backup)).toContain('tr:Q010');
    db.close();
  });

  it('mở lại DB v3 đã có dữ liệu không mất gì (mở app lần 2)', async () => {
    await makeV1();
    const a = new StudyDB(NAME);
    await a.open();
    a.close();
    const b = new StudyDB(NAME);
    expect(await b.items.count()).toBe(2);
    b.close();
  });
});

describe('lỗi lưu trữ', () => {
  it('không mở được IndexedDB → Progress vẫn chạy trong bộ nhớ và báo "unavailable"', async () => {
    const broken = new StudyDB('broken-db');
    broken.items.toArray = (() => Promise.reject(new Error('InvalidStateError'))) as unknown as typeof broken.items.toArray;
    const p = new Progress(broken, () => new Date(2026, 10, 3, 9));
    await p.load();
    expect(p.loaded).toBe(true);
    expect(p.problem).toBe('unavailable');
    p.grade('tr:K001', 2);
    expect(p.stateOf('tr:K001')?.box).toBe(1);
    await Dexie.delete('broken-db');
  });

  it('ghi lỗi do hết dung lượng → báo "quota"; lỗi khác → "write"; bấm Đã hiểu thì ẩn', async () => {
    const store = new StudyDB('quota-db');
    const p = new Progress(store, () => new Date(2026, 10, 3, 9));
    await p.load();
    const quota = Object.assign(new Error('x'), { name: 'AbortError', inner: { name: 'QuotaExceededError', message: 'QuotaExceededError' } });
    store.transaction = (() => Promise.reject(quota)) as unknown as typeof store.transaction;
    let calls = 0;
    p.subscribe(() => calls++);
    p.grade('tr:K001', 2);
    await p.flush();
    expect(p.problem).toBe('quota');
    expect(calls).toBeGreaterThan(1);
    p.dismissProblem();
    expect(p.problem).toBeNull();
    store.transaction = (() => Promise.reject(new Error('lỗi lạ'))) as unknown as typeof store.transaction;
    p.grade('tr:K002', 0);
    await p.flush();
    expect(p.problem).toBe('write');
    await store.delete();
  });

  it('isQuotaError nhận cả lỗi gốc và lỗi Dexie bọc ngoài', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError(new Dexie.QuotaExceededError('full'))).toBe(true);
    expect(isQuotaError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe(true);
    expect(isQuotaError(new Error('khác'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe('Progress: chấm trước khi đọc xong IndexedDB', () => {
  it('lượt chấm sớm được áp lại lên dữ liệu cũ, không bị ghi đè và không ghi đè thống kê cũ', async () => {
    const store = new StudyDB('early-db');
    await store.days.put({ day: '2026-11-03', n: 3, ok: 2, s: 60, nw: 2 });
    await store.items.put({ id: 'tr:K001', box: 3, due: '2026-11-03', wrong: 0, last: 1 });
    const now = () => new Date(2026, 10, 3, 9);
    const p = new Progress(store, now);
    const loading = p.load();
    expect(p.load()).toBe(loading); // hai component cùng gọi load → một lần đọc
    p.grade('tr:K001', 2); // trước khi đọc xong: chưa biết hộp 3
    p.grade('tr:Q001', 0);
    p.addSeconds(30);
    p.setNote('tr:Q001', 'sai vì nhầm');
    await loading;
    expect(p.stateOf('tr:K001')).toMatchObject({ box: 4 }); // tính lại từ hộp 3 trong máy
    expect(p.dayStat('2026-11-03')).toEqual({ day: '2026-11-03', n: 5, ok: 3, s: 90, nw: 3 });
    await p.flush();
    const q = new Progress(store, now);
    await q.load();
    expect(q.dayStat('2026-11-03')).toEqual({ day: '2026-11-03', n: 5, ok: 3, s: 90, nw: 3 });
    expect(q.stateOf('tr:K001')?.box).toBe(4);
    expect(q.note('tr:Q001')).toBe('sai vì nhầm');
    expect(await store.reviews.count()).toBe(2);
    await store.delete();
  });
});
