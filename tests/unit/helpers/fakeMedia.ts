import type { RecEnv, RecLike, RecResultEvent } from '../../../src/modules/english/speech/recognizer';
import type { MediaRecorderCtor, MediaRecorderLike, RecorderEnv, StreamLike } from '../../../src/modules/english/speech/recorder';

/** SpeechRecognition giả: test chủ động bắn kết quả / lỗi / end. */
export class FakeRec implements RecLike {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  started = 0;
  stopped = 0;
  aborted = 0;
  onresult: ((ev: RecResultEvent) => void) | null = null;
  onerror: ((ev: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  throwOnStart: Error | null = null;
  start() {
    if (this.throwOnStart) throw this.throwOnStart;
    this.started++;
  }
  stop() {
    this.stopped++;
  }
  abort() {
    this.aborted++;
  }
  /** Bắn kết quả: mỗi phần tử là [transcript | các phương án, isFinal]. */
  emit(parts: [string | string[], boolean][]) {
    const results = parts.map(([t, isFinal]) => {
      const alts = (Array.isArray(t) ? t : [t]).map((transcript) => ({ transcript }));
      return Object.assign(alts, { isFinal });
    });
    this.onresult?.({ resultIndex: 0, results });
  }
  error(e: string) {
    this.onerror?.({ error: e });
  }
  end() {
    this.onend?.();
  }
}

export function fakeRecEnv(opts: { supported?: boolean; online?: boolean } = {}) {
  const made: FakeRec[] = [];
  const timers: { fn: () => void; ms: number; id: number }[] = [];
  let nextId = 1;
  const state = { online: opts.online ?? true };
  const env: RecEnv = {
    create:
      opts.supported === false
        ? null
        : () => {
            const r = new FakeRec();
            made.push(r);
            return r;
          },
    online: () => state.online,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.push({ fn, ms, id });
      return id;
    },
    clearTimeout: (h) => {
      const i = timers.findIndex((t) => t.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
  };
  const runTimers = () => {
    const list = timers.splice(0);
    for (const t of list) t.fn();
  };
  return { env, made, timers, runTimers, state };
}

export class FakeTrack {
  stopped = false;
  stop() {
    this.stopped = true;
  }
}
export class FakeStream implements StreamLike {
  tracks = [new FakeTrack()];
  getTracks() {
    return this.tracks;
  }
}

export function fakeRecorderEnv(o: { supported?: string[] | null; gumError?: string; secure?: boolean; noMR?: boolean } = {}) {
  const streams: FakeStream[] = [];
  const recorders: FakeMR[] = [];
  let now = 1000;
  class FakeMR implements MediaRecorderLike {
    static isTypeSupported?: (t: string) => boolean;
    mimeType: string;
    state = 'inactive';
    ondataavailable: ((ev: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    constructor(
      public stream: StreamLike,
      public opts?: { mimeType?: string },
    ) {
      this.mimeType = opts?.mimeType ?? 'audio/webm';
      recorders.push(this);
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['abc'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  if (o.supported !== null) FakeMR.isTypeSupported = (t: string) => (o.supported ?? ['audio/mp4']).includes(t);
  const env: RecorderEnv = {
    getUserMedia: async () => {
      if (o.gumError) throw Object.assign(new Error(o.gumError), { name: o.gumError });
      const s = new FakeStream();
      streams.push(s);
      return s;
    },
    MediaRecorder: o.noMR ? null : (FakeMR as unknown as MediaRecorderCtor),
    secure: o.secure ?? true,
    now: () => now,
  };
  return { env, streams, recorders, advance: (ms: number) => (now += ms) };
}
