import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShadowPlayer } from '../../src/modules/english/player';
import { dialogueTracks, patternTracks, type TrackLine } from '../../src/modules/english/tracks';
import { PATTERNS } from '../../src/modules/english/content';
import { Tts } from '../../src/modules/english/tts';
import { FakeSynth, IOS_VOICES, fakeEnv } from './helpers/fakeSpeech';

const LINES: TrackLine[] = [{ en: 'Line one.', vi: 'Một' }, { en: 'Line two.', vi: 'Hai' }, { en: 'Line three.', vi: 'Ba' }];
const GAP = 500;

/** Chờ promise của speak() giải quyết (microtask). */
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('trình phát shadowing (mock speechSynthesis)', () => {
  let synth: FakeSynth;
  let player: ShadowPlayer;
  beforeEach(() => {
    vi.useFakeTimers();
    synth = new FakeSynth(IOS_VOICES);
    player = new ShadowPlayer(LINES, new Tts(fakeEnv(synth)), { rate: 0.85, gapMs: () => GAP });
  });
  afterEach(() => {
    player.destroy();
    vi.useRealTimers();
  });

  it('play phát câu 1 ngay (đồng bộ), nghỉ để nhại, rồi sang câu 2 … hết bài thì dừng', async () => {
    player.play();
    expect(synth.spoken.map((u) => u.text)).toEqual(['Line one.']);
    expect(synth.last?.rate).toBe(0.85);
    expect(player.getState()).toMatchObject({ index: 0, playing: true, phase: 'speaking' });
    synth.end();
    await flush();
    expect(player.getState().phase).toBe('gap');
    await vi.advanceTimersByTimeAsync(GAP);
    expect(player.getState()).toMatchObject({ index: 1, phase: 'speaking' });
    expect(synth.last?.text).toBe('Line two.');
    synth.end();
    await vi.advanceTimersByTimeAsync(GAP);
    synth.end();
    await vi.advanceTimersByTimeAsync(GAP);
    expect(player.getState()).toMatchObject({ index: 2, playing: false, ended: true });
    expect(synth.spoken).toHaveLength(3);
    // Phát lại sau khi hết bài → từ đầu.
    player.play();
    expect(player.getState().index).toBe(0);
    expect(synth.last?.text).toBe('Line one.');
  });

  it('lặp câu: đọc lại đúng câu hiện tại', async () => {
    player.toggleRepeat();
    player.play();
    synth.end();
    await vi.advanceTimersByTimeAsync(GAP);
    expect(player.getState().index).toBe(0);
    expect(synth.spoken.map((u) => u.text)).toEqual(['Line one.', 'Line one.']);
  });

  it('tạm dừng hủy âm thanh; sự kiện cũ không làm trình phát chạy tiếp', async () => {
    player.play();
    const first = synth.last;
    player.pause();
    expect(player.getState()).toMatchObject({ playing: false, phase: 'idle' });
    first?.onend?.({});
    await vi.advanceTimersByTimeAsync(GAP * 3);
    expect(player.getState().index).toBe(0);
    expect(synth.spoken).toHaveLength(1);
  });

  it('câu trước / sau: khi dừng chỉ đổi câu, khi đang phát thì phát câu mới; giới hạn hai đầu', () => {
    player.prev();
    expect(player.getState().index).toBe(0);
    player.next();
    player.next();
    player.next();
    expect(player.getState().index).toBe(2);
    expect(synth.spoken).toHaveLength(0);
    player.play();
    player.prev();
    expect(player.getState().index).toBe(1);
    expect(synth.last?.text).toBe('Line two.');
    player.goTo(0);
    expect(synth.last?.text).toBe('Line one.');
  });

  it('đổi tốc độ khi đang đọc: đọc lại câu với tốc độ mới (giới hạn 0,75–1×)', () => {
    player.play();
    player.setRate(1);
    expect(synth.spoken).toHaveLength(2);
    expect(synth.last?.rate).toBe(1);
    player.setRate(0.5);
    expect(player.getState().rate).toBe(0.75);
  });

  it('ẩn/hiện chữ', () => {
    expect(player.getState().showText).toBe(true);
    player.toggleText();
    expect(player.getState().showText).toBe(false);
  });

  it('destroy (rời trang) hủy âm thanh và hẹn giờ', async () => {
    player.play();
    synth.end();
    await flush();
    player.destroy();
    await vi.advanceTimersByTimeAsync(GAP * 2);
    expect(synth.spoken).toHaveLength(1);
    expect(synth.cancels).toBeGreaterThan(0);
  });

  it('hội thoại: người nói khác nhau dùng giọng khác nhau', () => {
    const [track] = dialogueTracks([
      {
        id: 'dl-0001',
        title: 'Asking for a raise',
        situation: 'Xin tăng lương',
        topic: 'negotiation',
        level: 'B2',
        lines: [
          { speaker: 'A', en: 'Do you have a minute?', vi: 'Có rảnh không?' },
          { speaker: 'B', en: 'Sure, what is it?', vi: 'Có, chuyện gì?' },
          { speaker: 'A', en: 'I would like to discuss my salary.', vi: 'Tôi muốn bàn về lương.' },
          { speaker: 'B', en: 'Of course.', vi: 'Được.' },
        ],
      },
    ]);
    expect(track?.lines[1]).toEqual({ en: 'Sure, what is it?', vi: 'Có, chuyện gì?', speaker: 'B' });
    const p = new ShadowPlayer(track?.lines ?? [], new Tts(fakeEnv(synth)), { accent: 'en-US', gapMs: () => GAP });
    p.play();
    const a = synth.last?.voice?.name;
    p.next();
    const b = synth.last?.voice?.name;
    expect(a).toBe('Ava (Enhanced)');
    expect(b).toBeTruthy();
    expect(b).not.toBe(a);
    p.destroy();
  });
});

describe('nguồn phát từ câu mẫu', () => {
  it('chia theo chủ đề, mỗi bài ≤ 10 câu, đủ 150 câu', () => {
    const tracks = patternTracks();
    expect(tracks.every((t) => t.lines.length > 0 && t.lines.length <= 10)).toBe(true);
    expect(tracks.reduce((s, t) => s + t.lines.length, 0)).toBe(PATTERNS.length);
    expect(new Set(tracks.map((t) => t.id)).size).toBe(tracks.length);
    expect(tracks[0]?.lines[0]).toEqual({ en: PATTERNS[0]?.en, vi: PATTERNS[0]?.vi, label: PATTERNS[0]?.situation });
  });
});
