import type { Accent, SpeakOptions, SpeakResult } from './tts';
import { clampRate, estimateMs } from './tts';
import type { TrackLine } from './tracks';

/**
 * Logic trình phát shadowing (không phụ thuộc React, test bằng mock speechSynthesis):
 * phát câu hiện tại → nghỉ một khoảng đủ để nhại lại → câu sau (hoặc lặp lại câu nếu bật lặp).
 * Hết bài thì dừng ở câu cuối.
 */
export interface Speaker {
  speak(text: string, opts?: SpeakOptions): Promise<SpeakResult>;
  cancel(): void;
}

export interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

export type Phase = 'idle' | 'speaking' | 'gap';

export interface PlayerState {
  index: number;
  playing: boolean;
  phase: Phase;
  repeat: boolean;
  rate: number;
  showText: boolean;
  /** Đã phát hết bài. */
  ended: boolean;
}

export interface PlayerOptions {
  rate?: number;
  accent?: Accent;
  repeat?: boolean;
  showText?: boolean;
  /** Khoảng nghỉ (ms) sau mỗi câu để nhại; mặc định ≈ thời gian đọc câu + 1 giây. */
  gapMs?: (line: TrackLine, rate: number) => number;
  timers?: Timers;
}

/** Nghỉ sau câu: bằng thời gian đọc câu ở tốc độ hiện tại + 1 giây (đủ để nhại lại). */
export const defaultGap = (line: TrackLine, rate: number): number => estimateMs(line.en, rate) + 1000;

export class ShadowPlayer {
  private s: PlayerState;
  private token = 0;
  private timer: unknown = null;
  private listeners = new Set<() => void>();
  private readonly timers: Timers;
  private readonly gap: (line: TrackLine, rate: number) => number;
  private speakerRank = new Map<string, number>();
  accent: Accent;

  constructor(
    private lines: readonly TrackLine[],
    private speaker: Speaker,
    o: PlayerOptions = {},
  ) {
    this.s = {
      index: 0,
      playing: false,
      phase: 'idle',
      repeat: o.repeat ?? false,
      rate: clampRate(o.rate ?? 0.85),
      showText: o.showText ?? true,
      ended: false,
    };
    this.accent = o.accent ?? 'en-US';
    this.gap = o.gapMs ?? defaultGap;
    this.timers = o.timers ?? {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    };
    // Người nói khác nhau trong hội thoại → giọng khác nhau (A = giọng tốt nhất, B = giọng thứ 2…).
    for (const l of lines) if (l.speaker && !this.speakerRank.has(l.speaker)) this.speakerRank.set(l.speaker, this.speakerRank.size);
  }

  get length(): number {
    return this.lines.length;
  }

  getState = (): PlayerState => this.s;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<PlayerState>) {
    this.s = { ...this.s, ...patch };
    for (const fn of this.listeners) fn();
  }

  line(i = this.s.index): TrackLine | undefined {
    return this.lines[i];
  }

  private clearTimer() {
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Dừng âm thanh và hẹn giờ đang chạy; các callback cũ bị bỏ nhờ token. */
  private halt() {
    this.token++;
    this.clearTimer();
    this.speaker.cancel();
  }

  private speakCurrent() {
    this.halt();
    const line = this.line();
    if (!line) {
      this.set({ playing: false, phase: 'idle' });
      return;
    }
    const my = this.token;
    this.set({ phase: 'speaking', ended: false });
    const rank = line.speaker ? (this.speakerRank.get(line.speaker) ?? 0) : 0;
    void this.speaker.speak(line.en, { rate: this.s.rate, accent: this.accent, voiceRank: rank }).then((res) => {
      if (my !== this.token || !this.s.playing) return;
      if (res === 'cancel') return;
      if (res === 'unsupported') {
        this.set({ playing: false, phase: 'idle' });
        return;
      }
      this.set({ phase: 'gap' });
      this.timer = this.timers.setTimeout(() => {
        this.timer = null;
        if (my !== this.token) return;
        this.afterLine();
      }, this.gap(line, this.s.rate));
    });
  }

  private afterLine() {
    if (!this.s.playing) return;
    if (this.s.repeat) return this.speakCurrent();
    if (this.s.index + 1 < this.lines.length) {
      this.set({ index: this.s.index + 1 });
      return this.speakCurrent();
    }
    this.set({ playing: false, phase: 'idle', ended: true });
  }

  /** Phát (gọi trong handler bấm để iOS cho phép). Hết bài thì phát lại từ đầu. */
  play(): void {
    if (!this.lines.length) return;
    if (this.s.ended && this.s.index >= this.lines.length - 1) this.set({ index: 0 });
    this.set({ playing: true, ended: false });
    this.speakCurrent();
  }

  pause(): void {
    this.halt();
    this.set({ playing: false, phase: 'idle' });
  }

  toggle(): void {
    if (this.s.playing) this.pause();
    else this.play();
  }

  goTo(i: number): void {
    const index = Math.max(0, Math.min(this.lines.length - 1, i));
    this.set({ index, ended: false });
    if (this.s.playing) this.speakCurrent();
    else this.halt();
  }

  next(): void {
    this.goTo(this.s.index + 1);
  }

  prev(): void {
    this.goTo(this.s.index - 1);
  }

  setRate(r: number): void {
    this.set({ rate: clampRate(r) });
    // Đang đọc thì đọc lại câu hiện tại với tốc độ mới.
    if (this.s.playing && this.s.phase === 'speaking') this.speakCurrent();
  }

  toggleRepeat(): void {
    this.set({ repeat: !this.s.repeat });
  }

  toggleText(): void {
    this.set({ showText: !this.s.showText });
  }

  /** Gọi khi rời màn hình. */
  destroy(): void {
    this.halt();
    this.listeners.clear();
    this.s = { ...this.s, playing: false, phase: 'idle' };
  }
}
