import { afterEach, describe, expect, it } from 'vitest';
import { AudioRecorder, MIME_CANDIDATES, RecorderError, extFor, mapMediaError, pickMimeType } from '../../src/modules/english/speech/recorder';
import { StudyDB } from '../../src/core/db';
import { deleteRecording, fmtDur, fmtSize, listRecordings, recordingBlob, saveRecording } from '../../src/modules/english/speech/recordings';
import { fakeRecorderEnv } from './helpers/fakeMedia';

describe('chọn mimeType ghi âm', () => {
  it('iOS Safari: mp4/AAC', () => {
    const ios = new Set(['audio/mp4', 'audio/mp4;codecs=mp4a.40.2']);
    expect(pickMimeType((t) => ios.has(t))).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
  });
  it('Chrome: webm/Opus; Firefox: ogg', () => {
    expect(pickMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMimeType((t) => t === 'audio/ogg;codecs=opus')).toBe('audio/ogg;codecs=opus');
  });
  it('không có isTypeSupported / không hỗ trợ gì / ném lỗi → chuỗi rỗng', () => {
    expect(pickMimeType(undefined)).toBe('');
    expect(pickMimeType(() => false)).toBe('');
    expect(
      pickMimeType(() => {
        throw new Error('x');
      }),
    ).toBe('');
    expect(MIME_CANDIDATES[0]).toContain('mp4');
  });
  it('đuôi file', () => {
    expect(extFor('audio/mp4;codecs=mp4a.40.2')).toBe('m4a');
    expect(extFor('audio/webm;codecs=opus')).toBe('webm');
    expect(extFor('audio/ogg')).toBe('ogg');
  });
});

describe('AudioRecorder', () => {
  it('ghi rồi dừng: trả blob đúng mimeType, độ dài, giải phóng track', async () => {
    const f = fakeRecorderEnv({ supported: ['audio/mp4'] });
    const r = new AudioRecorder(f.env);
    expect(r.supported).toBe(true);
    await r.start();
    expect(r.status).toBe('recording');
    expect(f.recorders[0]?.opts?.mimeType).toBe('audio/mp4');
    f.advance(42_000);
    expect(r.elapsed()).toBe(42_000);
    const out = await r.stop();
    expect(out.mime).toBe('audio/mp4');
    expect(out.ms).toBe(42_000);
    expect(out.blob.size).toBe(3);
    expect(f.streams[0]?.tracks[0]?.stopped).toBe(true);
    expect(r.status).toBe('idle');
  });

  it('isTypeSupported không có → để trình duyệt chọn', async () => {
    const f = fakeRecorderEnv({ supported: null });
    const r = new AudioRecorder(f.env);
    await r.start();
    expect(f.recorders[0]?.opts).toBeUndefined();
    expect(r.mime).toBe('audio/webm');
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'no-mic'],
    ['NotReadableError', 'busy'],
  ] as const)('getUserMedia lỗi %s → %s', async (name, code) => {
    const r = new AudioRecorder(fakeRecorderEnv({ gumError: name }).env);
    await expect(r.start()).rejects.toMatchObject({ code });
    expect(r.status).toBe('idle');
  });

  it('không hỗ trợ / không https', async () => {
    await expect(new AudioRecorder(fakeRecorderEnv({ noMR: true }).env).start()).rejects.toMatchObject({ code: 'unsupported' });
    await expect(new AudioRecorder(fakeRecorderEnv({ secure: false }).env).start()).rejects.toMatchObject({ code: 'insecure' });
    expect(mapMediaError(new RecorderError('busy'))).toBe('busy');
    expect(mapMediaError({ name: 'NotAllowedError' }, false)).toBe('insecure');
  });

  it('cancel: giải phóng micro, bỏ dữ liệu', async () => {
    const f = fakeRecorderEnv();
    const r = new AudioRecorder(f.env);
    await r.start();
    r.cancel();
    expect(f.streams[0]?.tracks[0]?.stopped).toBe(true);
    expect(r.status).toBe('idle');
    await expect(r.stop()).rejects.toBeInstanceOf(RecorderError);
  });
});

describe('kho bản ghi (IndexedDB)', () => {
  const store = new StudyDB('test-recordings');
  afterEach(async () => {
    await store.delete();
    await store.open();
  });

  it('lưu, liệt kê (mới nhất trước, lọc theo đề), dựng lại blob, xóa', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mp4' });
    const a = await saveRecording({ topicId: 'st-0001', title: 'Đề 1', blob, ms: 61_200, at: 100 }, store);
    const b = await saveRecording({ topicId: 'st-0002', title: 'Đề 2', blob, ms: 30_000, at: 200, transcript: '  hello  ' }, store);
    await saveRecording({ topicId: 'st-0001', title: 'Đề 1', blob, ms: 5_000, at: 300 }, store);

    const all = await listRecordings(undefined, store);
    expect(all.map((r) => r.at)).toEqual([300, 200, 100]);
    expect(all[1]?.transcript).toBe('hello');
    expect(all[0]?.size).toBe(4);
    expect(all[0]?.mime).toBe('audio/mp4');
    const t1 = await listRecordings('st-0001', store);
    expect(t1).toHaveLength(2);
    const back = recordingBlob(t1[1]!);
    expect(back.type).toBe('audio/mp4');
    expect(back.size).toBe(4);

    await deleteRecording(a, store);
    await deleteRecording(b, store);
    expect((await listRecordings(undefined, store)).map((r) => r.at)).toEqual([300]);
  });

  it('định dạng dung lượng / thời lượng', () => {
    expect(fmtSize(1536 * 1024)).toBe('1,5 MB');
    expect(fmtSize(300)).toBe('1 KB');
    expect(fmtDur(61_200)).toBe('1:01');
  });
});
