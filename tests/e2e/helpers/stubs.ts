/**
 * Stub các API trình duyệt cho e2e (truyền vào page.addInitScript, chạy trước mã trang; hàm phải tự đủ, không dùng biến ngoài):
 * - speechSynthesis: đọc xong sau 30 ms, ghi lại câu vào window.__spoken.
 * - webkitSpeechRecognition (kiểu Safari): sau 80 ms trả về window.__nextSay (hoặc lỗi "ERR:<mã>").
 * - getUserMedia + MediaRecorder kiểu iOS (chỉ audio/mp4); đếm track đã giải phóng (window.__tracksStopped).
 */
export const stubMedia = () => {
  const w = window as unknown as Record<string, unknown> & {
    __spoken: string[];
    __nextSay: string;
    __recStarts: number;
    __recLive: number;
    __tracksStopped: number;
    __synthCancels: number;
  };
  w.__spoken = [];
  w.__nextSay = '';
  w.__recStarts = 0;
  w.__recLive = 0;
  w.__tracksStopped = 0;
  w.__synthCancels = 0;
  class U {
    lang = '';
    rate = 1;
    pitch = 1;
    voice: unknown = null;
    onend: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    constructor(public text: string) {}
  }
  const synth = {
    speak(u: U) {
      w.__spoken.push(u.text);
      setTimeout(() => u.onend?.({}), 30);
    },
    cancel() {
      w.__synthCancels++;
    },
    pause() {},
    resume() {},
    getVoices: () => [{ name: 'Samantha', lang: 'en-US', localService: true, default: false, voiceURI: 'sam' }],
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: U, configurable: true });
  Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });

  class Rec {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    private live = false;
    start() {
      w.__recStarts++;
      w.__recLive++;
      this.live = true;
      const say = w.__nextSay;
      setTimeout(() => {
        if (!this.live) return;
        if (say.startsWith('ERR:')) this.onerror?.({ error: say.slice(4) });
        else if (say) this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: say }], { isFinal: true })] });
        if (!this.continuous && !say.startsWith('HOLD')) this.end();
      }, 80);
    }
    private end() {
      if (!this.live) return;
      this.live = false;
      w.__recLive--;
      setTimeout(() => this.onend?.(), 10);
    }
    stop() {
      this.end();
    }
    abort() {
      this.end();
    }
  }
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: Rec, configurable: true });

  const stream = { getTracks: () => [{ stop: () => w.__tracksStopped++ }] };
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: () => new Promise((res) => setTimeout(() => res(stream), 50)) },
    configurable: true,
  });
  class MR {
    static isTypeSupported = (t: string) => t === 'audio/mp4';
    state = 'inactive';
    mimeType: string;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(_s: unknown, o?: { mimeType?: string }) {
      this.mimeType = o?.mimeType ?? '';
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      setTimeout(() => {
        this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: this.mimeType }) });
        this.onstop?.();
      }, 20);
    }
  }
  Object.defineProperty(window, 'MediaRecorder', { value: MR, configurable: true });
};

/** Ghi lại mọi vi phạm CSP vào window.__csp. */
export const watchCsp = () => {
  const w = window as unknown as { __csp: string[] };
  w.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    w.__csp.push(`${e.effectiveDirective} ← ${e.blockedURI || '(inline)'}`);
  });
};
