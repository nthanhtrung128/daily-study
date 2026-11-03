import { afterEach, describe, expect, it } from 'vitest';
import {
  BackupError,
  applyBackup,
  exportBackup,
  fromLegacy,
  parseBackup,
  readLegacyLocal,
  summarize,
  LEGACY_KEY,
} from '../../src/core/backup';
import { StudyDB, getSetting } from '../../src/core/db';
import { Progress } from '../../src/core/progress';

/** State đúng định dạng Sổ ôn bản cũ (localStorage["tr101.state.v1"]). */
const LEGACY = {
  srs: {
    K001: [4, '2026-11-10', 0, '2026-10-27'],
    Q005: [1, '2026-11-01', 3, '2026-11-01'],
    G012: [2, '2026-11-04', 1, '2026-11-01'],
    'C-pit': [1, '2026-11-02', 2, '2026-11-01'],
    BAD: ['x', 'không phải ngày', 0, ''],
  },
  days: {
    '2026-10-31': { n: 20, ok: 15, s: 600 },
    '2026-11-01': { n: 35, ok: 20, s: 1200 },
    'sai-ngay': { n: 1 },
  },
  notes: { M01: 'Nhớ hỏi chị Lan về khung lương', K001: 'Ý chính: thu hút + giữ chân', X: '   ' },
  prefs: { min: 15, mode: 'quiz', bai: ['2', '3'] },
  sheetUrl: 'https://docs.google.com/x',
  updatedAt: Date.UTC(2026, 10, 1, 10),
};

describe('chuyển state bản cũ', () => {
  it('srs [hộp, hạn, sai, ngày cuối] → ItemState có tiền tố tr:', () => {
    const d = fromLegacy(LEGACY);
    expect(d.source).toBe('legacy');
    expect(d.items).toHaveLength(4);
    const k = d.items.find((i) => i.id === 'tr:K001');
    expect(k).toMatchObject({ box: 4, due: '2026-11-10', wrong: 0 });
    expect(new Date(k!.last).getDate()).toBe(27);
    expect(d.items.find((i) => i.id === 'tr:C-pit')).toMatchObject({ box: 1, wrong: 2 });
    expect(d.days).toEqual([
      { day: '2026-10-31', n: 20, ok: 15, s: 600 },
      { day: '2026-11-01', n: 35, ok: 20, s: 1200 },
    ]);
    expect(d.notes.map((n) => n.id).sort()).toEqual(['tr:K001', 'tr:M01']);
    expect(d.settings).toEqual([{ key: 'tr.prefs', value: { min: 15, mode: 'quiz', bai: ['2', '3'] } }]);
    expect(d.skipped).toBe(3);
    expect(summarize(d)).toMatchObject({ items: 4, learned: 1, wrong: 3, days: 2, reviews: 55, notes: 2, firstDay: '2026-10-31', lastDay: '2026-11-01' });
  });

  it('parseBackup tự nhận chuỗi JSON bản cũ (kể cả có BOM) và báo lỗi rõ ràng', () => {
    expect(parseBackup('﻿' + JSON.stringify(LEGACY)).source).toBe('legacy');
    expect(() => parseBackup('{oops')).toThrow(BackupError);
    expect(() => parseBackup('{"a":1}')).toThrow(/Không nhận ra định dạng/);
    expect(() => parseBackup({ app: 'daily-study', format: 99 })).toThrow(/mới hơn/);
  });

  it('đọc state bản cũ từ localStorage nếu có', () => {
    const store = new Map<string, string>([[LEGACY_KEY, JSON.stringify(LEGACY)]]);
    expect(readLegacyLocal({ getItem: (k) => store.get(k) ?? null })).toContain('"srs"');
    expect(readLegacyLocal({ getItem: () => null })).toBeNull();
    expect(
      readLegacyLocal({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBeNull();
  });
});

describe('xuất / nhập vào IndexedDB', () => {
  const a = new StudyDB('test-backup-a');
  const b = new StudyDB('test-backup-b');
  afterEach(async () => {
    await Promise.all([a.delete(), b.delete()]);
    await Promise.all([a.open(), b.open()]);
  });

  it('nhập state bản cũ (thay thế) → Progress đọc được, chuỗi ngày đúng', async () => {
    await a.items.put({ id: 'tr:Q999', box: 5, due: '2026-12-01', wrong: 0, last: 1 });
    await applyBackup(parseBackup(JSON.stringify(LEGACY)), 'replace', a);
    const p = new Progress(a, () => new Date(2026, 10, 1, 20));
    await p.load();
    expect(p.stateOf('tr:Q999')).toBeUndefined();
    expect(p.stateOf('tr:K001')?.box).toBe(4);
    expect(p.note('tr:M01')).toContain('khung lương');
    expect(p.streak()).toBe(2);
    expect(await getSetting('tr.prefs', null, a)).toEqual({ min: 15, mode: 'quiz', bai: ['2', '3'] });
  });

  it('xuất rồi nhập lại (vòng tròn) giữ nguyên dữ liệu', async () => {
    let now = new Date(2026, 10, 2, 9);
    const p = new Progress(a, () => now);
    await p.load();
    p.grade('tr:K001', 2);
    p.grade('en:ph-0001', 0);
    now = new Date(2026, 10, 3, 9);
    p.grade('tr:K001', 2);
    p.addSeconds(300);
    p.setNote('tr:K001', 'ghi chú có dấu: đãi ngộ');
    await p.flush();
    await a.settings.put({ key: 'tr.prefs', value: { min: 20, mode: 'mix', bai: [] } });

    const dump = await exportBackup(a, new Date(2026, 10, 3, 10));
    expect(dump.app).toBe('daily-study');
    const text = JSON.stringify(dump);
    await applyBackup(parseBackup(text), 'replace', b);
    const again = await exportBackup(b, new Date(2026, 10, 3, 10));
    expect(again).toEqual(dump);

    const q = new Progress(b, () => now);
    await q.load();
    expect(q.stateOf('tr:K001')).toMatchObject({ box: 2, due: '2026-11-06' });
    expect(q.stateOf('en:ph-0001')?.wrong).toBe(1);
    expect(q.note('tr:K001')).toBe('ghi chú có dấu: đãi ngộ');
    expect(q.dayStat('2026-11-03').s).toBe(300);
    expect(q.streak()).toBe(2);
    expect(await b.reviews.count()).toBe(3);
  });

  it('gộp: mỗi mục giữ lần ôn gần nhất, ngày lấy số lớn hơn, không đè cài đặt hiện có', async () => {
    await a.items.bulkPut([
      { id: 'tr:K001', box: 5, due: '2026-12-30', wrong: 0, last: Date.UTC(2026, 10, 2) },
      { id: 'tr:Q005', box: 1, due: '2026-10-20', wrong: 1, last: Date.UTC(2026, 9, 19) },
    ]);
    await a.days.put({ day: '2026-11-01', n: 50, ok: 10, s: 100 });
    await a.notes.put({ id: 'tr:K001', text: 'bản mới trên máy', at: Date.UTC(2026, 10, 3) });
    await a.settings.put({ key: 'tr.prefs', value: { min: 5, mode: 'mix', bai: [] } });

    await applyBackup(fromLegacy(LEGACY), 'merge', a);
    expect((await a.items.get('tr:K001'))?.box).toBe(5); // trên máy mới hơn → giữ
    expect((await a.items.get('tr:Q005'))?.wrong).toBe(3); // bản cũ mới hơn → lấy
    expect(await a.items.get('tr:G012')).toBeDefined();
    expect(await a.days.get('2026-11-01')).toEqual({ day: '2026-11-01', n: 50, ok: 20, s: 1200 });
    expect((await a.notes.get('tr:K001'))?.text).toBe('bản mới trên máy');
    expect((await a.notes.get('tr:M01'))?.text).toContain('khung lương');
    expect(await getSetting('tr.prefs', null, a)).toEqual({ min: 5, mode: 'mix', bai: [] });
  });

  it('bỏ dòng sai định dạng trong file của app', () => {
    const d = parseBackup({
      app: 'daily-study',
      format: 1,
      items: [{ id: 'tr:K1', box: 9, due: '2026-11-01', wrong: '2', last: 5 }, { id: 'tr:K2', box: 1 }, 'x'],
      days: [{ day: '2026-11-01', n: 3, ok: 9 }, { day: '2026-11-02', n: 4, ok: 1, s: 60, nw: 2 }],
      notes: [{ id: 'tr:K1', text: '' }],
      reviews: [{ itemId: 'tr:K1', day: '2026-11-01', grade: 2, at: 1 }, { itemId: 'tr:K1', day: 'x', grade: 2 }],
      settings: [{ key: 'a', value: 1 }, { nokey: 1 }],
    });
    expect(d.items).toEqual([{ id: 'tr:K1', box: 5, due: '2026-11-01', wrong: 2, last: 5 }]);
    expect(d.days).toEqual([
      { day: '2026-11-01', n: 3, ok: 3, s: 0 },
      { day: '2026-11-02', n: 4, ok: 1, s: 60, nw: 2 },
    ]);
    expect(d.notes).toEqual([]);
    expect(d.reviews).toHaveLength(1);
    expect(d.settings).toEqual([{ key: 'a', value: 1 }]);
    expect(d.skipped).toBe(5);
  });
});
