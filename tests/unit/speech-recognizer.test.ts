import { describe, expect, it } from 'vitest';
import { REC_ERROR_VI, SpeechRec, mapRecError } from '../../src/modules/english/speech/recognizer';
import { fakeRecEnv } from './helpers/fakeMedia';

describe('SpeechRec — lớp bọc nhận giọng', () => {
  it('không hỗ trợ → lỗi unsupported, không ném', async () => {
    const { env } = fakeRecEnv({ supported: false });
    const r = new SpeechRec(env);
    expect(r.supported).toBe(false);
    const out = await r.start();
    expect(out.error).toBe('unsupported');
    expect(r.getState().error).toBe('unsupported');
    expect(REC_ERROR_VI.unsupported).toMatch(/không hỗ trợ/);
  });

  it('start gọi rec.start đồng bộ (iOS), đặt en-US + interim; kết quả tạm rồi cuối', async () => {
    const { env, made } = fakeRecEnv();
    const r = new SpeechRec(env);
    const seen: string[] = [];
    r.subscribe(() => seen.push(`${r.getState().status}|${r.getState().final}|${r.getState().interim}`));
    const p = r.start();
    const rec = made[0]!;
    expect(rec.started).toBe(1);
    expect(rec.lang).toBe('en-US');
    expect(rec.interimResults).toBe(true);
    expect(rec.continuous).toBe(false);
    expect(r.getState().status).toBe('listening');
    rec.emit([['could you', false]]);
    expect(r.getState().interim).toBe('could you');
    rec.emit([[['Could you help me', 'could you help me'], true]]);
    expect(r.getState().final).toBe('Could you help me');
    rec.end();
    const out = await p;
    expect(out).toEqual({ transcript: 'Could you help me', alternatives: ['Could you help me', 'could you help me'], error: null, aborted: false });
    expect(r.getState().status).toBe('idle');
    expect(seen.some((s) => s.startsWith('listening||could you'))).toBe(true);
  });

  it('stop: chốt cả phần tạm; watchdog khi trình duyệt không bắn end', async () => {
    const { env, made, runTimers } = fakeRecEnv();
    const r = new SpeechRec(env);
    const p = r.start();
    made[0]!.emit([['thanks for', true], ['your help', false]]);
    r.stop();
    expect(made[0]!.stopped).toBe(1);
    expect(r.getState().status).toBe('stopping');
    runTimers(); // không có onend
    const out = await p;
    expect(out.transcript).toBe('thanks for your help');
    expect(out.alternatives).toEqual(['thanks for your help']);
  });

  it.each([
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'service'],
    ['network', 'network'],
    ['audio-capture', 'audio-capture'],
    ['language-not-supported', 'language'],
    ['weird', 'other'],
  ] as const)('lỗi %s → %s, có thông báo tiếng Việt', async (browserErr, code) => {
    const { env, made } = fakeRecEnv();
    const r = new SpeechRec(env);
    const p = r.start();
    made[0]!.error(browserErr);
    made[0]!.end();
    const out = await p;
    expect(out.error).toBe(code);
    expect(r.getState().error).toBe(code);
    expect(REC_ERROR_VI[code].length).toBeGreaterThan(10);
  });

  it('không nghe thấy gì → no-speech; mất mạng → network', async () => {
    const a = fakeRecEnv();
    const r1 = new SpeechRec(a.env);
    const p1 = r1.start();
    a.made[0]!.error('no-speech');
    a.made[0]!.end();
    expect((await p1).error).toBe('no-speech');

    const b = fakeRecEnv({ online: false });
    const r2 = new SpeechRec(b.env);
    const p2 = r2.start();
    b.made[0]!.end();
    expect((await p2).error).toBe('network');
  });

  it('abort: bỏ kết quả, không báo lỗi; lượt mới hủy lượt cũ', async () => {
    const { env, made } = fakeRecEnv();
    const r = new SpeechRec(env);
    const p1 = r.start();
    made[0]!.emit([['hello', false]]);
    const p2 = r.start();
    const o1 = await p1;
    expect(o1.aborted).toBe(true);
    expect(o1.error).toBeNull();
    expect(made[0]!.aborted).toBe(1);
    made[0]!.emit([['ignored', true]]);
    expect(r.getState().final).toBe('');
    made[1]!.emit([['hi there', true]]);
    made[1]!.end();
    expect((await p2).transcript).toBe('hi there');
  });

  it('start ném lỗi (đang chạy chỗ khác) → busy', async () => {
    const { env } = fakeRecEnv();
    const r = new SpeechRec({
      ...env,
      create: () => {
        const x = env.create!();
        (x as unknown as { throwOnStart: Error }).throwOnStart = Object.assign(new Error('x'), { name: 'InvalidStateError' });
        return x;
      },
    });
    expect((await r.start()).error).toBe('busy');
  });

  it('keepAlive: trình duyệt tự ngắt thì khởi động lại, nối transcript; bỏ qua no-speech', async () => {
    const { env, made } = fakeRecEnv();
    const r = new SpeechRec(env);
    const p = r.start({ keepAlive: true });
    const rec = made[0]!;
    expect(rec.continuous).toBe(true);
    rec.emit([['first part', true]]);
    rec.end();
    expect(rec.started).toBe(2);
    rec.error('no-speech');
    rec.end();
    expect(rec.started).toBe(3);
    rec.emit([['second part', true]]);
    expect(r.getState().final).toBe('first part second part');
    r.stop();
    rec.end();
    const out = await p;
    expect(out.transcript).toBe('first part second part');
    expect(out.error).toBeNull();
  });

  it('keepAlive dừng hẳn khi lỗi nặng (bị từ chối quyền)', async () => {
    const { env, made } = fakeRecEnv();
    const r = new SpeechRec(env);
    const p = r.start({ keepAlive: true });
    made[0]!.error('not-allowed');
    made[0]!.end();
    expect((await p).error).toBe('denied');
    expect(made[0]!.started).toBe(1);
  });

  it('tự dừng sau maxMs', async () => {
    const { env, made, timers, runTimers } = fakeRecEnv();
    const r = new SpeechRec(env);
    const p = r.start({ maxMs: 5000 });
    expect(timers[0]?.ms).toBe(5000);
    made[0]!.emit([['ok', true]]);
    runTimers();
    expect(made[0]!.stopped).toBe(1);
    made[0]!.end();
    expect((await p).transcript).toBe('ok');
  });

  it('mã lỗi', () => {
    expect(mapRecError('aborted')).toBe('aborted');
    expect(mapRecError('no-speech')).toBe('no-speech');
  });

  it('hủy khi ẩn trang', async () => {
    const { env, made } = fakeRecEnv();
    const r = new SpeechRec(env);
    const off = r.bindPageLifecycle();
    const p = r.start();
    window.dispatchEvent(new Event('pagehide'));
    expect((await p).aborted).toBe(true);
    expect(made[0]!.aborted).toBe(1);
    off();
  });
});
