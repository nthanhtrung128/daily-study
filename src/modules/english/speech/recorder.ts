/**
 * Ghi âm bằng MediaRecorder (chỉ lưu trên máy).
 * - Chọn mimeType máy hỗ trợ bằng `MediaRecorder.isTypeSupported`: iOS Safari → audio/mp4 (AAC),
 *   Chrome/Firefox → audio/webm (Opus). Không hỏi được thì để trình duyệt tự chọn.
 * - Xin quyền micro (`getUserMedia`) trong handler bấm; luôn giải phóng track khi dừng / hủy / lỗi
 *   để tắt chấm cam "đang dùng micro" trên iPhone.
 */

/** Thứ tự ưu tiên: mp4/AAC trước (iOS phát lại được mọi nơi), rồi webm/ogg Opus. */
export const MIME_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
] as const;

/** Chọn mimeType ghi âm. Trả về '' khi không kiểm được (để MediaRecorder tự chọn). */
export function pickMimeType(isTypeSupported?: ((t: string) => boolean) | null, candidates: readonly string[] = MIME_CANDIDATES): string {
  if (typeof isTypeSupported !== 'function') return '';
  for (const t of candidates) {
    try {
      if (isTypeSupported(t)) return t;
    } catch {
      /* Safari cũ ném lỗi với chuỗi lạ */
    }
  }
  return '';
}

/** Đuôi file theo mimeType (để tải về / đặt tên). */
export function extFor(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('mp4') || m.includes('aac') || m.includes('m4a')) return 'm4a';
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  return 'audio';
}

export type RecorderErrorCode = 'unsupported' | 'insecure' | 'denied' | 'no-mic' | 'busy' | 'other';

export const RECORDER_ERROR_VI: Record<RecorderErrorCode, string> = {
  unsupported: 'Trình duyệt này không hỗ trợ ghi âm (MediaRecorder). Trên iPhone cần iOS 14.3 trở lên (Safari).',
  insecure: 'Chỉ ghi âm được khi mở app qua https (hoặc localhost).',
  denied: 'Chưa được cấp quyền micro. Trên iPhone: Cài đặt → Safari → Micrô → Cho phép (hoặc bấm “aA” trên thanh địa chỉ → Cài đặt trang web). Rồi thử lại.',
  'no-mic': 'Không tìm thấy micro trên máy.',
  busy: 'Micro đang bị ứng dụng khác dùng (cuộc gọi, ghi âm…). Đóng ứng dụng đó rồi thử lại.',
  other: 'Không ghi âm được. Thử lại sau vài giây.',
};

export class RecorderError extends Error {
  constructor(public code: RecorderErrorCode) {
    super(RECORDER_ERROR_VI[code]);
    this.name = 'RecorderError';
  }
}

/** Lỗi getUserMedia / MediaRecorder → mã lỗi của app. */
export function mapMediaError(e: unknown, secure = true): RecorderErrorCode {
  if (e instanceof RecorderError) return e.code;
  const name = (e as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return secure ? 'denied' : 'insecure';
  if (name === 'SecurityError') return secure ? 'denied' : 'insecure';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no-mic';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  if (name === 'NotSupportedError' || name === 'TypeError') return 'unsupported';
  return 'other';
}

/** Tập con của MediaStream / MediaRecorder cần dùng. */
export interface StreamLike {
  getTracks(): { stop(): void }[];
}
export interface MediaRecorderLike {
  readonly mimeType: string;
  readonly state: string;
  start(timeslice?: number): void;
  stop(): void;
  ondataavailable: ((ev: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((ev: unknown) => void) | null;
}
export interface MediaRecorderCtor {
  new (stream: StreamLike, opts?: { mimeType?: string; audioBitsPerSecond?: number }): MediaRecorderLike;
  isTypeSupported?: (t: string) => boolean;
}

export interface RecorderEnv {
  getUserMedia: ((c: { audio: boolean | object }) => Promise<StreamLike>) | null;
  MediaRecorder: MediaRecorderCtor | null;
  secure: boolean;
  now: () => number;
}

function browserEnv(): RecorderEnv {
  const g = globalThis as unknown as { navigator?: Navigator; MediaRecorder?: MediaRecorderCtor; isSecureContext?: boolean };
  const md = g.navigator?.mediaDevices;
  return {
    getUserMedia: md?.getUserMedia ? (c) => md.getUserMedia(c as MediaStreamConstraints) as Promise<StreamLike> : null,
    MediaRecorder: g.MediaRecorder ?? null,
    secure: g.isSecureContext !== false,
    now: () => Date.now(),
  };
}

export interface RecordingResult {
  blob: Blob;
  mime: string;
  ms: number;
}

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopping';

export class AudioRecorder {
  private envCache: RecorderEnv | null;
  private stream: StreamLike | null = null;
  private mr: MediaRecorderLike | null = null;
  private chunks: Blob[] = [];
  private t0 = 0;
  private stopP: Promise<RecordingResult> | null = null;
  private token = 0;
  status: RecorderStatus = 'idle';
  mime = '';

  constructor(env?: RecorderEnv) {
    this.envCache = env ?? null;
  }

  private get env(): RecorderEnv {
    return (this.envCache ??= browserEnv());
  }

  get supported(): boolean {
    return !!this.env.getUserMedia && !!this.env.MediaRecorder;
  }

  /**
   * Xin quyền micro và bắt đầu ghi. Gọi trong onClick: `getUserMedia` được gọi ngay (đồng bộ)
   * nên vẫn nằm trong cử chỉ người dùng. Ném RecorderError khi lỗi.
   */
  async start(): Promise<void> {
    const { getUserMedia, MediaRecorder: MR, secure } = this.env;
    if (!secure) throw new RecorderError('insecure');
    if (!getUserMedia || !MR) throw new RecorderError('unsupported');
    if (this.status !== 'idle') this.cancel();
    const my = ++this.token;
    this.status = 'requesting';
    let stream: StreamLike;
    try {
      stream = await getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      if (my === this.token) this.status = 'idle';
      throw new RecorderError(mapMediaError(e, secure));
    }
    if (my !== this.token) {
      // Bị hủy trong lúc chờ quyền.
      stopTracks(stream);
      throw new RecorderError('other');
    }
    this.stream = stream;
    const mime = pickMimeType(MR.isTypeSupported?.bind(MR));
    let mr: MediaRecorderLike;
    try {
      mr = mime ? new MR(stream, { mimeType: mime, audioBitsPerSecond: 64000 }) : new MR(stream);
    } catch {
      try {
        mr = new MR(stream);
      } catch (e) {
        this.release();
        this.status = 'idle';
        throw new RecorderError(mapMediaError(e));
      }
    }
    this.mr = mr;
    this.mime = mr.mimeType || mime || 'audio/mp4';
    this.chunks = [];
    mr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
    };
    try {
      // timeslice 1 s: Safari cũ dồn hết vào một chunk lúc dừng, vẫn chạy được.
      mr.start(1000);
    } catch (e) {
      this.release();
      this.status = 'idle';
      throw new RecorderError(mapMediaError(e));
    }
    this.t0 = this.env.now();
    this.status = 'recording';
  }

  /** Thời gian đã ghi (ms). */
  elapsed(): number {
    return this.status === 'recording' ? this.env.now() - this.t0 : 0;
  }

  /** Dừng ghi, trả về blob. Luôn giải phóng micro. */
  stop(): Promise<RecordingResult> {
    if (this.stopP) return this.stopP;
    const mr = this.mr;
    if (!mr || this.status !== 'recording') return Promise.reject(new RecorderError('other'));
    this.status = 'stopping';
    const ms = this.env.now() - this.t0;
    this.stopP = new Promise<RecordingResult>((resolve) => {
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        const mime = this.mime;
        const blob = new Blob(this.chunks, { type: mime });
        this.chunks = [];
        this.release();
        this.status = 'idle';
        this.stopP = null;
        resolve({ blob, mime, ms });
      };
      mr.onstop = fin;
      mr.onerror = fin;
      try {
        if (mr.state !== 'inactive') mr.stop();
        else fin();
      } catch {
        fin();
      }
      // Watchdog: không có onstop thì vẫn kết thúc.
      setTimeout(fin, 3000);
    });
    return this.stopP;
  }

  /** Hủy, bỏ dữ liệu (rời màn hình). */
  cancel(): void {
    this.token++;
    const mr = this.mr;
    if (mr) {
      mr.ondataavailable = null;
      mr.onstop = null;
      try {
        if (mr.state !== 'inactive') mr.stop();
      } catch {
        /* bỏ qua */
      }
    }
    this.chunks = [];
    this.release();
    this.stopP = null;
    this.status = 'idle';
  }

  private release() {
    if (this.stream) stopTracks(this.stream);
    this.stream = null;
    this.mr = null;
  }
}

function stopTracks(s: StreamLike) {
  try {
    for (const t of s.getTracks()) t.stop();
  } catch {
    /* bỏ qua */
  }
}
