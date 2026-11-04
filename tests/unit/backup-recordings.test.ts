import { afterEach, describe, expect, it } from 'vitest';
import {
  applyBackup,
  b64Len,
  backupParts,
  estimateRecordingsBytes,
  exportBackup,
  fromBase64,
  parseBackup,
  recordingStats,
  summarize,
  toBase64,
} from '../../src/core/backup';
import { LAST_KEY, SNOOZE_KEY } from '../../src/core/backupReminder';
import { StudyDB, type Recording } from '../../src/core/db';

/** Âm thanh giả: byte 0–255 lặp lại, có cả byte "khó" (0, 255) và độ dài không chia hết cho 3. */
const audio = (n: number, seed = 0) => {
  const u = new Uint8Array(n);
  for (let i = 0; i < n; i++) u[i] = (i * 31 + seed) & 0xff;
  return u.buffer;
};
const bytes = (b: ArrayBuffer) => [...new Uint8Array(b)];

const rec = (over: Partial<Recording> = {}): Recording => {
  const data = over.data ?? audio(1000);
  return { topicId: 'st-0001', title: 'Describe your team', at: Date.UTC(2026, 10, 1, 2), ms: 45_000, mime: 'audio/mp4', size: data.byteLength, data, ...over };
};

describe('base64', () => {
  it('mã hóa / giải mã khớp từng byte, kể cả dữ liệu lớn hơn một khúc', () => {
    for (const n of [0, 1, 2, 3, 4, 0x6000, 0x6000 + 1, 100_003]) {
      const buf = audio(n, n);
      const s = toBase64(buf);
      expect(s.length).toBe(b64Len(n));
      expect(bytes(fromBase64(s))).toEqual(bytes(buf));
    }
    expect(toBase64(new Uint8Array([0, 255, 128]))).toBe('AP+A');
  });
  it('chuỗi sai → lỗi', () => {
    expect(() => fromBase64('@@@')).toThrow();
  });
});

describe('sao lưu kèm bản ghi âm', () => {
  const a = new StudyDB('test-rec-a');
  const b = new StudyDB('test-rec-b');
  afterEach(async () => {
    await Promise.all([a.delete(), b.delete()]);
    await Promise.all([a.open(), b.open()]);
  });

  it('vòng tròn xuất → nhập (thay thế) giữ nguyên từng byte, mime, thời lượng, đề', async () => {
    const r1 = rec({ data: audio(70_001, 7), transcript: 'We review salaries every April.' });
    const r2 = rec({ topicId: 'st-0002', title: 'Một đề có dấu', at: Date.UTC(2026, 10, 2), ms: 61_000, mime: 'audio/webm;codecs=opus', data: audio(5, 9) });
    await a.recordings.bulkAdd([r1, r2]);
    await a.items.put({ id: 'tr:K001', box: 3, due: '2026-11-10', wrong: 0, last: 1 });
    await b.recordings.add(rec({ topicId: 'st-9999', data: audio(10) }));

    const dump = await exportBackup(a, new Date(2026, 10, 3), { recordings: true });
    expect(dump.recordings).toHaveLength(2);
    const text = backupParts(dump).join('');
    // File vẫn là JSON hợp lệ của app.
    expect(JSON.parse(text)).toMatchObject({ app: 'daily-study', format: 1 });

    const parsed = parseBackup(text);
    expect(summarize(parsed).recordings).toBe(2);
    await applyBackup(parsed, 'replace', b);

    const got = (await b.recordings.orderBy('at').toArray()).map(({ id: _id, ...r }) => r);
    expect(got).toHaveLength(2);
    expect(got[0]).toMatchObject({ topicId: 'st-0001', title: 'Describe your team', ms: 45_000, mime: 'audio/mp4', size: 70_001, transcript: 'We review salaries every April.' });
    expect(got[1]).toMatchObject({ topicId: 'st-0002', title: 'Một đề có dấu', ms: 61_000, mime: 'audio/webm;codecs=opus', size: 5 });
    expect(bytes(got[0]!.data)).toEqual(bytes(r1.data));
    expect(bytes(got[1]!.data)).toEqual(bytes(r2.data));
    expect((await b.items.get('tr:K001'))?.box).toBe(3);
  });

  it('xuất không kèm ghi âm: không có trường recordings; nhập vào máy khác giữ nguyên ghi âm ở đó', async () => {
    await a.recordings.add(rec());
    const dump = await exportBackup(a, new Date(2026, 10, 3));
    expect(dump).not.toHaveProperty('recordings');
    expect(backupParts(dump)).toHaveLength(1);
    await b.recordings.add(rec({ topicId: 'st-0042' }));
    const parsed = parseBackup(backupParts(dump).join(''));
    expect(parsed.recordings).toBeUndefined();
    await applyBackup(parsed, 'replace', b);
    expect((await b.recordings.toArray()).map((r) => r.topicId)).toEqual(['st-0042']);
  });

  it('nhập file cũ (không có trường ghi âm) vẫn được, ở cả hai chế độ', async () => {
    const old = {
      app: 'daily-study',
      format: 1,
      exportedAt: '2026-10-01T00:00:00.000Z',
      items: [{ id: 'tr:K001', box: 2, due: '2026-10-05', wrong: 1, last: 5 }],
      days: [{ day: '2026-10-01', n: 3, ok: 2, s: 60 }],
      notes: [],
      reviews: [],
      settings: [],
    };
    await b.recordings.add(rec());
    for (const mode of ['merge', 'replace'] as const) {
      await applyBackup(parseBackup(JSON.stringify(old)), mode, b);
      expect(await b.recordings.count()).toBe(1);
      expect((await b.items.get('tr:K001'))?.box).toBe(2);
    }
  });

  it('gộp không nhân đôi bản ghi trùng (kể cả nhập cùng file hai lần)', async () => {
    const same = rec({ data: audio(300, 1) });
    await a.recordings.bulkAdd([{ ...same }, rec({ topicId: 'st-0003', at: 2, data: audio(50) })]);
    await b.recordings.bulkAdd([{ ...same }, rec({ topicId: 'st-0004', at: 3, data: audio(60) })]);
    const text = backupParts(await exportBackup(a, new Date(), { recordings: true })).join('');
    await applyBackup(parseBackup(text), 'merge', b);
    await applyBackup(parseBackup(text), 'merge', b);
    const ids = (await b.recordings.toArray()).map((r) => r.topicId).sort();
    expect(ids).toEqual(['st-0001', 'st-0003', 'st-0004']);
  });

  it('bỏ bản ghi sai định dạng; mime lạ → audio/mp4', () => {
    const p = parseBackup({
      app: 'daily-study',
      format: 1,
      recordings: [
        { topicId: 'st-1', title: 'ok', at: 5, ms: 1000, mime: 'text/html', data: toBase64(audio(4)) },
        { topicId: 'st-2', at: 5, data: 'không phải base64!' },
        { topicId: '', at: 5, data: 'AAAA' },
        { topicId: 'st-3', at: 'x', data: 'AAAA' },
        { topicId: 'st-4', at: 5, data: '' },
      ],
    });
    expect(p.recordings).toHaveLength(1);
    expect(p.recordings![0]).toMatchObject({ topicId: 'st-1', mime: 'audio/mp4', size: 4 });
    expect(p.skipped).toBe(4);
  });

  it('không mang thời điểm sao lưu / hoãn nhắc sang máy khác', async () => {
    await a.settings.bulkPut([
      { key: LAST_KEY, value: 111 },
      { key: SNOOZE_KEY, value: 222 },
      { key: 'backup.remindDays', value: 30 },
    ]);
    const dump = await exportBackup(a);
    expect(dump.settings.map((s) => s.key)).toEqual(['backup.remindDays']);
    await b.settings.put({ key: LAST_KEY, value: 999 });
    const p = parseBackup({ ...dump, settings: [...dump.settings, { key: LAST_KEY, value: 1 }] });
    await applyBackup(p, 'replace', b);
    expect((await b.settings.get(LAST_KEY))?.value).toBe(999);
    expect((await b.settings.get('backup.remindDays'))?.value).toBe(30);
  });

  it('ước tính dung lượng khớp gần đúng kích thước file thật', async () => {
    await a.recordings.bulkAdd([rec({ data: audio(200_000) }), rec({ at: 9, data: audio(150_000) })]);
    const st = await recordingStats(a);
    expect(st.count).toBe(2);
    expect(st.bytes).toBe(estimateRecordingsBytes(await a.recordings.toArray()));
    const withRec = backupParts(await exportBackup(a, new Date(), { recordings: true })).join('').length;
    const without = backupParts(await exportBackup(a)).join('').length;
    expect(Math.abs(withRec - without - st.bytes) / st.bytes).toBeLessThan(0.02);
  });
});
