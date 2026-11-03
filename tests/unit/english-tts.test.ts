import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tts, clampRate, estimateMs, normLang, pickVoice, rankVoices, scoreVoice } from '../../src/modules/english/tts';
import { CHROME_VOICES, FakeSynth, IOS_VOICES, fakeEnv } from './helpers/fakeSpeech';

describe('chọn giọng', () => {
  it('iPhone: chọn giọng Enhanced/Premium đúng giọng Mỹ/Anh, bỏ giọng "vui" và tiếng Việt', () => {
    expect(pickVoice(IOS_VOICES, 'en-US')?.name).toBe('Ava (Enhanced)');
    expect(pickVoice(IOS_VOICES, 'en-GB')?.name).toBe('Serena (Premium)');
    const us = rankVoices(IOS_VOICES, 'en-US').map((v) => v.name);
    expect(us).not.toContain('Linh');
    expect(us.indexOf('Zarvox')).toBeGreaterThan(us.indexOf('Karen'));
    expect(us.indexOf('Albert')).toBeGreaterThan(us.indexOf('Daniel'));
  });

  it('Chrome: ưu tiên giọng Google đúng giọng', () => {
    expect(pickVoice(CHROME_VOICES, 'en-US')?.name).toBe('Google US English');
    expect(pickVoice(CHROME_VOICES, 'en-GB')?.name).toBe('Google UK English Female');
  });

  it('không có đúng giọng thì lấy tiếng Anh khác; không có tiếng Anh → null', () => {
    expect(pickVoice([{ name: 'Karen', lang: 'en_AU' }], 'en-GB')?.name).toBe('Karen');
    expect(pickVoice([{ name: 'Linh', lang: 'vi-VN' }], 'en-US')).toBeNull();
    expect(pickVoice([], 'en-US')).toBeNull();
  });

  it('chuẩn hóa mã ngôn ngữ kiểu Android "en_US"', () => {
    expect(normLang('en_US')).toBe('en-US');
    expect(scoreVoice({ name: 'x', lang: 'en_US' }, 'en-US')).toBeGreaterThanOrEqual(100);
  });

  it('tốc độ giới hạn 0,75–1×', () => {
    expect(clampRate(0.5)).toBe(0.75);
    expect(clampRate(1.5)).toBe(1);
    expect(clampRate(0.85)).toBe(0.85);
    expect(clampRate(Number.NaN)).toBe(1);
    expect(estimateMs('one two three four five', 0.75)).toBeGreaterThan(estimateMs('one two three four five', 1));
  });
});

describe('Tts — lớp bọc speechSynthesis', () => {
  afterEach(() => vi.useRealTimers());

  it('phát đồng bộ trong cùng lời gọi (iOS), đặt giọng tốt nhất + tốc độ, kết thúc "end"', async () => {
    const synth = new FakeSynth(IOS_VOICES);
    const t = new Tts(fakeEnv(synth));
    const p = t.speak('Could you help me?', { rate: 0.85, accent: 'en-US' });
    expect(synth.spoken).toHaveLength(1); // đã gọi synth.speak trước khi có await nào
    expect(synth.last?.voice?.name).toBe('Ava (Enhanced)');
    expect(synth.last?.rate).toBe(0.85);
    expect(synth.last?.lang).toBe('en-US');
    expect(t.speaking).toBe(true);
    synth.end();
    await expect(p).resolves.toBe('end');
    expect(t.speaking).toBe(false);
  });

  it('giọng chưa tải: vẫn phát theo lang; sau voiceschanged thì dùng giọng tốt nhất', async () => {
    const synth = new FakeSynth([]);
    const t = new Tts(fakeEnv(synth));
    t.warm();
    void t.speak('Hello', { accent: 'en-GB' });
    expect(synth.last?.voice).toBeNull();
    expect(synth.last?.lang).toBe('en-GB');
    synth.loadVoices(IOS_VOICES);
    void t.speak('Hello again', { accent: 'en-GB' });
    expect(synth.last?.voice?.name).toBe('Serena (Premium)');
  });

  it('loadVoices chờ voiceschanged, hoặc hết giờ thì trả danh sách rỗng', async () => {
    vi.useFakeTimers();
    const synth = new FakeSynth([]);
    const t = new Tts(fakeEnv(synth));
    const p = t.loadVoices(1000);
    synth.loadVoices(CHROME_VOICES);
    await expect(p).resolves.toHaveLength(CHROME_VOICES.length);

    const t2 = new Tts(fakeEnv(new FakeSynth([])));
    const p2 = t2.loadVoices(1000);
    vi.advanceTimersByTime(1000);
    await expect(p2).resolves.toEqual([]);
  });

  it('câu mới hủy câu cũ ("cancel"); cancel() dừng hẳn', async () => {
    const synth = new FakeSynth(IOS_VOICES);
    const t = new Tts(fakeEnv(synth));
    const a = t.speak('first');
    const b = t.speak('second');
    await expect(a).resolves.toBe('cancel');
    t.cancel();
    await expect(b).resolves.toBe('cancel');
    expect(synth.cancels).toBeGreaterThanOrEqual(2);
  });

  it('watchdog: trình duyệt không bắn end (lỗi iOS) thì vẫn kết thúc', async () => {
    vi.useFakeTimers();
    const t = new Tts(fakeEnv(new FakeSynth(IOS_VOICES)));
    const p = t.speak('short line');
    vi.advanceTimersByTime(estimateMs('short line', 1) * 2 + 4001);
    await expect(p).resolves.toBe('end');
  });

  it('không hỗ trợ speechSynthesis → "unsupported", không ném lỗi', async () => {
    const t = new Tts(fakeEnv(null));
    expect(t.supported).toBe(false);
    await expect(t.speak('hi')).resolves.toBe('unsupported');
    expect(() => t.cancel()).not.toThrow();
  });

  it('rời trang (pagehide) hoặc ẩn app → hủy đọc', async () => {
    const synth = new FakeSynth(IOS_VOICES);
    const t = new Tts(fakeEnv(synth));
    const win = new EventTarget();
    const off = t.bindPageLifecycle(win, document);
    const p = t.speak('hello');
    win.dispatchEvent(new Event('pagehide'));
    await expect(p).resolves.toBe('cancel');
    off();
    const p2 = t.speak('again');
    win.dispatchEvent(new Event('pagehide'));
    expect(t.speaking).toBe(true); // đã gỡ listener
    synth.end();
    await expect(p2).resolves.toBe('end');
  });
});
