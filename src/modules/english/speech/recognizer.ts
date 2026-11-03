/**
 * Lớp bọc Web Speech API `SpeechRecognition` / `webkitSpeechRecognition` (miễn phí, có sẵn trong trình duyệt).
 * - `start()` gọi `rec.start()` ĐỒNG BỘ trong handler bấm (iOS Safari chỉ cho nhận giọng sau thao tác người dùng).
 * - Kết quả tạm thời (interim) + cuối (final), cập nhật qua `subscribe` / `getState`.
 * - Lỗi được quy về mã ngắn + thông báo tiếng Việt: không hỗ trợ, bị từ chối quyền, không nghe thấy, mất mạng…
 *   (Safari iOS và Chrome gửi âm thanh tới máy chủ nhận giọng của hãng trình duyệt nên thường cần mạng.)
 * - `keepAlive`: nhận giọng liên tục (đề nói 1 phút) — trình duyệt tự ngắt sau vài giây im lặng thì khởi động lại.
 * - Watchdog: nếu trình duyệt không bắn `end` sau khi dừng (lỗi hay gặp trên iOS) thì tự kết thúc.
 */

export type RecErrorCode = 'unsupported' | 'denied' | 'service' | 'no-speech' | 'audio-capture' | 'network' | 'language' | 'busy' | 'other';

export const REC_ERROR_VI: Record<RecErrorCode, string> = {
  unsupported:
    'Trình duyệt này không hỗ trợ nhận giọng nói. Trên iPhone hãy dùng Safari (iOS 14.5 trở lên); trên máy tính dùng Chrome, Edge hoặc Safari. Bạn vẫn có thể gõ bằng bàn phím (bấm micro trên bàn phím iPhone để đọc chính tả).',
  denied:
    'Chưa được cấp quyền micro / nhận giọng. Trên iPhone: Cài đặt → Safari → Micrô → Cho phép; và cho phép “Nhận dạng giọng nói” khi Safari hỏi. Sau đó tải lại trang và thử lại.',
  service:
    'Dịch vụ nhận giọng đang tắt. Trên iPhone: Cài đặt → Cài đặt chung → Bàn phím → bật “Đọc chính tả”, và kiểm tra Cài đặt → Thời gian sử dụng không chặn Siri & Đọc chính tả.',
  'no-speech': 'Không nghe thấy gì. Hãy nói to, rõ hơn và gần micro, rồi bấm “Nói thử” lại.',
  'audio-capture': 'Không mở được micro (không tìm thấy hoặc ứng dụng khác đang dùng). Kiểm tra micro rồi thử lại.',
  network:
    'Không kết nối được dịch vụ nhận giọng. Safari/Chrome cần mạng để nhận giọng nói — kiểm tra Wi-Fi/4G rồi thử lại. (Ghi âm đề nói vẫn chạy khi không có mạng.)',
  language: 'Máy chưa hỗ trợ nhận giọng tiếng Anh (en-US). Thử thêm tiếng Anh vào ngôn ngữ đọc chính tả của máy.',
  busy: 'Đang nhận giọng ở chỗ khác. Đợi một chút rồi thử lại.',
  other: 'Nhận giọng gặp lỗi. Thử lại sau vài giây.',
};

/** Tập con của SpeechRecognition cần dùng (để test bằng đối tượng thường). */
export interface RecAlternative {
  transcript: string;
  confidence?: number;
}
export interface RecResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [i: number]: RecAlternative;
}
export interface RecResultEvent {
  resultIndex: number;
  results: { readonly length: number; [i: number]: RecResultLike };
}
export interface RecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: RecResultEvent) => void) | null;
  onerror: ((ev: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
}

export interface RecEnv {
  /** null = trình duyệt không hỗ trợ. */
  create: (() => RecLike) | null;
  online: () => boolean;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

export type RecStatus = 'idle' | 'listening' | 'stopping';

export interface RecState {
  status: RecStatus;
  /** Phần đã chốt. */
  final: string;
  /** Phần đang nghe (chưa chốt). */
  interim: string;
  error: RecErrorCode | null;
}

export interface RecOutcome {
  /** Toàn bộ câu nghe được (đã chốt + phần tạm cuối cùng). */
  transcript: string;
  /** Các phương án của câu (khi chỉ có một đoạn kết quả), phương án tốt nhất đứng đầu. */
  alternatives: string[];
  error: RecErrorCode | null;
  /** Bị hủy bằng abort() (rời màn, bấm nghe mẫu…). */
  aborted: boolean;
}

export interface RecOptions {
  lang?: string;
  /** Nhận liên tục, tự khởi động lại khi trình duyệt ngắt (đề nói dài). */
  keepAlive?: boolean;
  /** Tự dừng sau chừng này ms (mặc định 15 s cho một câu; keepAlive: không giới hạn). */
  maxMs?: number;
}

/** Mã lỗi của trình duyệt → mã lỗi của app. */
export function mapRecError(err: string): RecErrorCode | 'aborted' {
  switch (err) {
    case 'not-allowed':
      return 'denied';
    case 'service-not-allowed':
      return 'service';
    case 'no-speech':
      return 'no-speech';
    case 'audio-capture':
      return 'audio-capture';
    case 'network':
      return 'network';
    case 'language-not-supported':
    case 'bad-grammar':
      return 'language';
    case 'aborted':
      return 'aborted';
    default:
      return 'other';
  }
}

/** Lỗi không thể tự khởi động lại. */
const FATAL = new Set<RecErrorCode>(['denied', 'service', 'audio-capture', 'network', 'language', 'unsupported']);

function browserEnv(): RecEnv {
  const g = globalThis as unknown as { SpeechRecognition?: new () => RecLike; webkitSpeechRecognition?: new () => RecLike; navigator?: Navigator };
  const Ctor = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  return {
    create: Ctor ? () => new Ctor() : null,
    online: () => g.navigator?.onLine !== false,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
}

const IDLE: RecState = { status: 'idle', final: '', interim: '', error: null };
const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ');

export class SpeechRec {
  private envCache: RecEnv | null;
  private s: RecState = IDLE;
  private listeners = new Set<() => void>();
  private run: {
    rec: RecLike;
    opts: RecOptions;
    /** Văn bản của các lượt trước (keepAlive khởi động lại). */
    prefix: string;
    final: string;
    interim: string;
    alts: string[];
    segs: number;
    error: RecErrorCode | null;
    stopping: boolean;
    aborted: boolean;
    restarts: number;
    timer: unknown;
    resolve: (o: RecOutcome) => void;
  } | null = null;

  /** Không truyền env → dùng API của trình duyệt, đọc lúc dùng lần đầu. */
  constructor(env?: RecEnv) {
    this.envCache = env ?? null;
  }

  private get env(): RecEnv {
    return (this.envCache ??= browserEnv());
  }

  get supported(): boolean {
    return !!this.env.create;
  }

  get active(): boolean {
    return !!this.run;
  }

  getState = (): RecState => this.s;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<RecState>) {
    this.s = { ...this.s, ...patch };
    for (const fn of this.listeners) fn();
  }

  /**
   * Bắt đầu nghe — gọi trực tiếp trong onClick. Đang nghe dở thì hủy lượt cũ.
   * Promise luôn kết thúc với transcript và mã lỗi (nếu có).
   */
  start(opts: RecOptions = {}): Promise<RecOutcome> {
    if (this.run) this.abort();
    const create = this.env.create;
    if (!create) {
      this.set({ ...IDLE, error: 'unsupported' });
      return Promise.resolve({ transcript: '', alternatives: [], error: 'unsupported', aborted: false });
    }
    let rec: RecLike;
    try {
      rec = create();
    } catch {
      this.set({ ...IDLE, error: 'unsupported' });
      return Promise.resolve({ transcript: '', alternatives: [], error: 'unsupported', aborted: false });
    }
    rec.lang = opts.lang ?? 'en-US';
    rec.continuous = !!opts.keepAlive;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    return new Promise<RecOutcome>((resolve) => {
      const run = {
        rec,
        opts,
        prefix: '',
        final: '',
        interim: '',
        alts: [] as string[],
        segs: 0,
        error: null as RecErrorCode | null,
        stopping: false,
        aborted: false,
        restarts: 0,
        timer: null as unknown,
        resolve,
      };
      this.run = run;
      rec.onresult = (ev) => {
        if (this.run !== run) return;
        let fin = '';
        let tmp = '';
        const list = ev.results;
        for (let i = 0; i < list.length; i++) {
          const r = list[i];
          if (!r) continue;
          const t = r[0]?.transcript ?? '';
          if (r.isFinal) fin = join(fin, t);
          else tmp = join(tmp, t);
        }
        run.final = fin;
        run.interim = tmp;
        run.segs = list.length;
        // Phương án thay thế chỉ có nghĩa khi cả câu nằm trong một đoạn kết quả.
        const only = list.length === 1 ? list[0] : undefined;
        run.alts = [];
        if (only) for (let k = 0; k < only.length; k++) if (only[k]?.transcript) run.alts.push(only[k]!.transcript.trim());
        this.set({ final: join(run.prefix, fin), interim: tmp });
      };
      rec.onerror = (ev) => {
        if (this.run !== run) return;
        const code = mapRecError(ev?.error ?? '');
        if (code === 'aborted') return;
        // Đề nói dài: im lặng một lúc thì bỏ qua, khởi động lại ở onend.
        if (code === 'no-speech' && opts.keepAlive) return;
        run.error = code;
      };
      rec.onend = () => {
        if (this.run !== run) return;
        if (opts.keepAlive && !run.stopping && !run.aborted && !(run.error && FATAL.has(run.error)) && run.restarts < 50) {
          run.prefix = join(run.prefix, run.final, run.interim);
          run.final = '';
          run.interim = '';
          run.error = null;
          run.restarts++;
          try {
            rec.start();
            return;
          } catch {
            /* không khởi động lại được → kết thúc */
          }
        }
        this.finish(run);
      };
      this.set({ status: 'listening', final: '', interim: '', error: null });
      try {
        rec.start();
      } catch (e) {
        run.error = (e as { name?: string })?.name === 'InvalidStateError' ? 'busy' : 'other';
        this.finish(run);
        return;
      }
      const max = opts.maxMs ?? (opts.keepAlive ? 0 : 15000);
      if (max > 0) run.timer = this.env.setTimeout(() => this.stop(), max);
    });
  }

  private finish(run: NonNullable<SpeechRec['run']>) {
    if (this.run !== run) return;
    this.run = null;
    this.env.clearTimeout(run.timer);
    run.rec.onresult = null;
    run.rec.onerror = null;
    run.rec.onend = null;
    const transcript = join(run.prefix, run.final, run.interim);
    let error = run.error;
    if (!transcript && !error && !run.aborted) error = 'no-speech';
    // Không có mạng mà không nghe được gì → nhiều khả năng do mất mạng (iOS không báo lỗi rõ).
    if (!transcript && error === 'no-speech' && !this.env.online()) error = 'network';
    if (transcript && error === 'no-speech') error = null;
    const alternatives = run.prefix || run.segs !== 1 || !run.alts.length ? [transcript].filter(Boolean) : run.alts;
    this.set({ status: 'idle', final: transcript, interim: '', error: run.aborted ? null : error });
    run.resolve({ transcript, alternatives, error: run.aborted ? null : error, aborted: run.aborted });
  }

  /** Dừng nghe và chốt kết quả (bấm "Dừng", hết giờ). */
  stop(): void {
    const run = this.run;
    if (!run || run.stopping) return;
    run.stopping = true;
    this.set({ status: 'stopping' });
    this.env.clearTimeout(run.timer);
    try {
      run.rec.stop();
    } catch {
      this.finish(run);
      return;
    }
    // Watchdog: iOS đôi khi không bắn end.
    run.timer = this.env.setTimeout(() => this.finish(run), 2500);
  }

  /** Hủy ngay, bỏ kết quả. */
  abort(): void {
    const run = this.run;
    if (!run) return;
    run.aborted = true;
    try {
      run.rec.abort();
    } catch {
      /* bỏ qua */
    }
    this.finish(run);
  }

  /** Xóa thông báo lỗi / kết quả cũ trên giao diện. */
  reset(): void {
    if (!this.run) this.set(IDLE);
  }

  /** Hủy khi rời trang hoặc chuyển ứng dụng. */
  bindPageLifecycle(win: EventTarget = window, doc: Document = document): () => void {
    const stop = () => this.abort();
    const vis = () => {
      if (doc.visibilityState === 'hidden') this.abort();
    };
    win.addEventListener('pagehide', stop);
    doc.addEventListener('visibilitychange', vis);
    return () => {
      win.removeEventListener('pagehide', stop);
      doc.removeEventListener('visibilitychange', vis);
    };
  }
}

/** Một thể hiện dùng chung cho cả app (chỉ một lượt nghe tại một thời điểm). */
export const speechRec = new SpeechRec();
