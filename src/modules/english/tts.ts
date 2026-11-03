/**
 * Lớp bọc Web Speech API `speechSynthesis` (miễn phí, chạy trên máy).
 * - Chọn giọng en-US / en-GB tốt nhất máy có (ưu tiên giọng Enhanced/Premium/Siri/Natural, bỏ giọng "vui").
 * - Tốc độ giới hạn 0,75–1×.
 * - iOS chỉ cho phát sau thao tác bấm: `speak()` gọi `synth.speak` ĐỒNG BỘ (không await gì trước đó)
 *   để vẫn nằm trong cử chỉ người dùng. Nếu danh sách giọng chưa tải (`voiceschanged` chưa bắn),
 *   vẫn phát bằng `lang` để hệ thống tự chọn giọng, và lần sau dùng giọng tốt nhất.
 * - Hủy khi rời trang (`pagehide`, tab ẩn) và khi component gọi `cancel()` lúc unmount.
 */

export type Accent = 'en-US' | 'en-GB';
export const ACCENTS: readonly { id: Accent; label: string }[] = [
  { id: 'en-US', label: 'Giọng Mỹ' },
  { id: 'en-GB', label: 'Giọng Anh' },
];
export const RATES = [0.75, 0.85, 1] as const;
export const MIN_RATE = 0.75;
export const MAX_RATE = 1;

/** Tập con của SpeechSynthesisVoice cần dùng (để test bằng đối tượng thường). */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
  voiceURI?: string;
}

export interface UtteranceLike {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  voice: VoiceLike | null;
  onend: ((ev: unknown) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
}

export interface SynthLike {
  speak(u: UtteranceLike): void;
  cancel(): void;
  getVoices(): VoiceLike[];
  addEventListener?(type: 'voiceschanged', fn: () => void): void;
  removeEventListener?(type: 'voiceschanged', fn: () => void): void;
  onvoiceschanged?: (() => void) | null;
}

export interface TtsEnv {
  synth: SynthLike | null;
  makeUtterance: (text: string) => UtteranceLike;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

export type SpeakResult = 'end' | 'cancel' | 'error' | 'unsupported';

export interface SpeakOptions {
  rate?: number;
  accent?: Accent;
  /** Chọn giọng thứ n trong danh sách xếp hạng (vd người nói B trong hội thoại). */
  voiceRank?: number;
}

/** Chuẩn hóa mã ngôn ngữ: "en_US" → "en-US". */
export const normLang = (lang: string): string => lang.replace('_', '-').trim();

/** Giọng "vui"/hiệu ứng trên macOS/iOS và giọng nén chất lượng thấp — không dùng để học phát âm. */
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|pipe organ|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;
const QUALITY = /(premium|enhanced|neural|natural|siri|\(high\)|high quality)/i;

/**
 * Điểm một giọng cho giọng mong muốn. < 0 = không dùng được (không phải tiếng Anh).
 * Đúng giọng (US/GB) > tiếng Anh khác; chất lượng cao > thường; giọng trên máy (offline) được cộng nhẹ.
 */
export function scoreVoice(v: VoiceLike, accent: Accent): number {
  const lang = normLang(v.lang).toLowerCase();
  if (!lang.startsWith('en')) return -1;
  let s = 0;
  if (lang === accent.toLowerCase()) s += 100;
  else if (lang === 'en-us' || lang === 'en-gb') s += 60;
  else if (lang === 'en') s += 50;
  else s += 40; // en-AU, en-IE, en-IN…
  if (QUALITY.test(v.name)) s += 30;
  if (/google/i.test(v.name)) s += 12; // giọng Google trên Chrome khá tự nhiên
  if (/samantha|daniel|karen|moira|serena|ava|allison|susan|tom|alex/i.test(v.name)) s += 8;
  if (/compact|eloquence/i.test(v.name)) s -= 15;
  if (NOVELTY.test(v.name)) s -= 80;
  if (v.localService) s += 3;
  if (v.default) s += 1;
  return s;
}

/** Danh sách giọng tiếng Anh xếp theo điểm giảm dần. */
export function rankVoices(voices: readonly VoiceLike[], accent: Accent): VoiceLike[] {
  return voices
    .map((v, i) => ({ v, s: scoreVoice(v, accent), i }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.v);
}

export function pickVoice(voices: readonly VoiceLike[], accent: Accent): VoiceLike | null {
  return rankVoices(voices, accent)[0] ?? null;
}

export const clampRate = (r: number): number => (Number.isFinite(r) ? Math.min(MAX_RATE, Math.max(MIN_RATE, r)) : 1);

/** Ước lượng thời gian đọc (ms) — dùng cho watchdog khi trình duyệt không bắn `end` (lỗi hay gặp trên iOS). */
export function estimateMs(text: string, rate = 1): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(((words / 2.6) * 1000) / clampRate(rate));
}

function browserEnv(): TtsEnv {
  const g = globalThis as { speechSynthesis?: SpeechSynthesis; SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance };
  const synth = (g.speechSynthesis ?? null) as unknown as SynthLike | null;
  const U = g.SpeechSynthesisUtterance;
  return {
    synth: synth && U ? synth : null,
    makeUtterance: (text) => new (U as typeof SpeechSynthesisUtterance)(text) as unknown as UtteranceLike,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
}

export class Tts {
  private voices: VoiceLike[] = [];
  private current: { u: UtteranceLike; done: (r: SpeakResult) => void } | null = null;
  private listeners = new Set<() => void>();
  private bound = false;
  private envCache: TtsEnv | null;

  /** Không truyền env → dùng speechSynthesis của trình duyệt, đọc lúc dùng lần đầu (không lúc import). */
  constructor(env?: TtsEnv) {
    this.envCache = env ?? null;
  }

  private get env(): TtsEnv {
    return (this.envCache ??= browserEnv());
  }

  get supported(): boolean {
    return !!this.env.synth;
  }

  /** Đang phát (theo lớp bọc, không phụ thuộc `synth.speaking` vốn không đáng tin trên iOS). */
  get speaking(): boolean {
    return !!this.current;
  }

  /** Đăng ký nhận thay đổi (danh sách giọng tải xong, bắt đầu / dừng phát). */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    for (const fn of this.listeners) fn();
  }

  /** Đọc danh sách giọng; nếu rỗng thì nghe `voiceschanged` (Chrome, Safari tải giọng bất đồng bộ). */
  warm(): void {
    const s = this.env.synth;
    if (!s) return;
    this.refresh();
    if (this.bound) return;
    this.bound = true;
    const on = () => this.refresh();
    if (s.addEventListener) s.addEventListener('voiceschanged', on);
    else s.onvoiceschanged = on;
  }

  private refresh() {
    try {
      const list = this.env.synth?.getVoices() ?? [];
      if (list.length && list.length !== this.voices.length) {
        this.voices = list.slice();
        this.emit();
      } else if (list.length) this.voices = list.slice();
    } catch {
      /* một số trình duyệt ném lỗi khi chưa sẵn sàng */
    }
  }

  /** Chờ danh sách giọng (tối đa `timeoutMs`). Không dùng trước `speak` trong cử chỉ bấm. */
  loadVoices(timeoutMs = 1500): Promise<VoiceLike[]> {
    this.warm();
    if (this.voices.length || !this.env.synth) return Promise.resolve(this.voices);
    return new Promise((resolve) => {
      const off = this.subscribe(() => {
        if (!this.voices.length) return;
        off();
        this.env.clearTimeout(t);
        resolve(this.voices);
      });
      const t = this.env.setTimeout(() => {
        off();
        this.refresh();
        resolve(this.voices);
      }, timeoutMs);
    });
  }

  voiceFor(accent: Accent, rank = 0): VoiceLike | null {
    if (!this.voices.length) this.refresh();
    const ranked = rankVoices(this.voices, accent);
    if (!ranked.length) return null;
    // Người nói thứ 2: lấy giọng khác cùng giọng (US/GB) nếu có, không thì dùng lại giọng tốt nhất.
    const same = ranked.filter((v) => normLang(v.lang).toLowerCase() === accent.toLowerCase());
    const pool = same.length > rank ? same : ranked;
    return pool[rank % pool.length] ?? null;
  }

  /**
   * Phát một câu. Gọi đồng bộ trong handler bấm (iOS). Câu đang phát dở bị hủy ('cancel').
   * Promise luôn kết thúc: 'end' | 'cancel' | 'error' | 'unsupported'.
   */
  speak(text: string, opts: SpeakOptions = {}): Promise<SpeakResult> {
    const s = this.env.synth;
    if (!s || !text.trim()) return Promise.resolve('unsupported');
    this.cancel();
    const accent = opts.accent ?? 'en-US';
    const rate = clampRate(opts.rate ?? 1);
    const u = this.env.makeUtterance(text);
    u.lang = accent;
    u.rate = rate;
    u.pitch = 1;
    const v = this.voiceFor(accent, opts.voiceRank ?? 0);
    if (v) {
      u.voice = v;
      u.lang = normLang(v.lang);
    }
    return new Promise<SpeakResult>((resolve) => {
      const timer: { h?: unknown } = {};
      const done = (r: SpeakResult) => {
        if (this.current?.u !== u) return;
        this.current = null;
        this.env.clearTimeout(timer.h);
        resolve(r);
        this.emit();
      };
      u.onend = () => done('end');
      u.onerror = (ev) => done(ev?.error === 'interrupted' || ev?.error === 'canceled' ? 'cancel' : 'error');
      this.current = { u, done };
      // Giữ tham chiếu `u` (this.current) để Safari không thu gom rác làm mất sự kiện end.
      timer.h = this.env.setTimeout(() => done('end'), estimateMs(text, rate) * 2 + 4000);
      try {
        s.speak(u);
      } catch {
        done('error');
        return;
      }
      this.emit();
    });
  }

  /** Dừng câu đang phát (rời trang, đổi thẻ, bấm dừng). */
  cancel(): void {
    const cur = this.current;
    if (cur) cur.done('cancel');
    try {
      this.env.synth?.cancel();
    } catch {
      /* bỏ qua */
    }
  }

  /** Hủy phát khi rời trang hoặc chuyển ứng dụng (iOS tiếp tục đọc nền nếu không hủy). */
  bindPageLifecycle(win: EventTarget = window, doc: Document = document): () => void {
    const stop = () => this.cancel();
    const vis = () => {
      if (doc.visibilityState === 'hidden') this.cancel();
    };
    win.addEventListener('pagehide', stop);
    doc.addEventListener('visibilitychange', vis);
    return () => {
      win.removeEventListener('pagehide', stop);
      doc.removeEventListener('visibilitychange', vis);
    };
  }
}

/** Một thể hiện dùng chung cho cả app. */
export const tts = new Tts();
