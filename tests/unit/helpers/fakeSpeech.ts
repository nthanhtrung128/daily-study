import type { SynthLike, TtsEnv, UtteranceLike, VoiceLike } from '../../../src/modules/english/tts';

/** speechSynthesis giả: ghi lại các câu được phát, cho test chủ động bắn end / voiceschanged. */
export class FakeSynth implements SynthLike {
  spoken: UtteranceLike[] = [];
  cancels = 0;
  voices: VoiceLike[];
  private vc = new Set<() => void>();

  constructor(voices: VoiceLike[] = []) {
    this.voices = voices;
  }
  speak(u: UtteranceLike) {
    this.spoken.push(u);
  }
  cancel() {
    this.cancels++;
    // Trình duyệt thật bắn error "interrupted"/"canceled" cho câu đang phát.
    const last = this.spoken[this.spoken.length - 1];
    last?.onerror?.({ error: 'interrupted' });
  }
  getVoices() {
    return this.voices;
  }
  addEventListener(_t: 'voiceschanged', fn: () => void) {
    this.vc.add(fn);
  }
  removeEventListener(_t: 'voiceschanged', fn: () => void) {
    this.vc.delete(fn);
  }
  /** Giả lập giọng tải xong. */
  loadVoices(v: VoiceLike[]) {
    this.voices = v;
    this.vc.forEach((fn) => fn());
  }
  get last(): UtteranceLike | undefined {
    return this.spoken[this.spoken.length - 1];
  }
  /** Câu cuối đọc xong. */
  end() {
    this.last?.onend?.({});
  }
}

export function fakeEnv(synth: FakeSynth | null): TtsEnv {
  return {
    synth,
    makeUtterance: (text) => ({ text, lang: '', rate: 1, pitch: 1, voice: null, onend: null, onerror: null }),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
}

/** Danh sách giọng giống iPhone (iOS 17): có giọng Enhanced, giọng "vui", nhiều ngôn ngữ. */
export const IOS_VOICES: VoiceLike[] = [
  { name: 'Linh', lang: 'vi-VN', localService: true, default: true },
  { name: 'Albert', lang: 'en-US', localService: true },
  { name: 'Samantha', lang: 'en-US', localService: true },
  { name: 'Ava (Enhanced)', lang: 'en-US', localService: true },
  { name: 'Daniel', lang: 'en-GB', localService: true },
  { name: 'Serena (Premium)', lang: 'en-GB', localService: true },
  { name: 'Karen', lang: 'en-AU', localService: true },
  { name: 'Zarvox', lang: 'en-US', localService: true },
];

/** Danh sách giọng giống Chrome trên máy tính. */
export const CHROME_VOICES: VoiceLike[] = [
  { name: 'Microsoft An - Vietnamese (Vietnam)', lang: 'vi-VN', localService: true, default: true },
  { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true },
  { name: 'Google US English', lang: 'en-US', localService: false },
  { name: 'Google UK English Female', lang: 'en-GB', localService: false },
];
