import { expect, test, type Page } from '@playwright/test';

/**
 * Stub các API giọng nói của trình duyệt (chạy trước mã trang):
 * - speechSynthesis: ghi lại câu được đọc.
 * - webkitSpeechRecognition (kiểu Safari): khi start, sau 80 ms trả về window.__nextSay (hoặc lỗi "ERR:<mã>").
 * - getUserMedia + MediaRecorder kiểu iOS (chỉ hỗ trợ audio/mp4): đếm track đã giải phóng.
 */
const stubMedia = () => {
  const w = window as unknown as Record<string, unknown> & { __spoken: string[]; __nextSay: string; __recStarts: number; __tracksStopped: number; __mime: string };
  w.__spoken = [];
  w.__nextSay = '';
  w.__recStarts = 0;
  w.__tracksStopped = 0;
  w.__mime = '';
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
    cancel() {},
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
      this.live = true;
      const say = w.__nextSay;
      setTimeout(() => {
        if (!this.live) return;
        if (say.startsWith('ERR:')) this.onerror?.({ error: say.slice(4) });
        else if (say) {
          const r = Object.assign([{ transcript: say }], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: [r] });
        }
        if (!this.continuous) this.end();
      }, 80);
    }
    private end() {
      if (!this.live) return;
      this.live = false;
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
      w.__mime = this.mimeType;
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

const noHScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};
const setSay = (page: Page, s: string) => page.evaluate((x) => ((window as unknown as { __nextSay: string }).__nextSay = x), s);
const win = <T,>(page: Page, k: string) => page.evaluate((key) => (window as unknown as Record<string, unknown>)[key], k) as Promise<T>;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(stubMedia);
});

test('luyện nói: nói đúng → 100% + Nhớ rõ; nói thiếu → tô từ thiếu; mất mạng → thông báo; nút Nói thử trong thẻ câu mẫu', async ({ page }) => {
  await page.goto('./#hom-nay');
  await page.getByRole('button', { name: 'EN 5 phút' }).click();
  await page.getByRole('button', { name: /^Luyện nói/ }).click();
  await expect(page.getByTestId('sess-count')).toHaveText('1/5');
  expect(await win<number>(page, '__recStarts')).toBe(0);

  const target = (await page.getByTestId('say-target').textContent()) ?? '';
  await setSay(page, target);
  await page.getByRole('button', { name: 'Nói thử' }).click();
  await expect(page.getByTestId('say-score')).toHaveText('100%');
  await noHScroll(page);
  await page.getByRole('button', { name: /^Tiếp · Nhớ rõ/ }).click();
  await expect(page.getByTestId('sess-count')).toHaveText('2/5');

  const t2 = (await page.getByTestId('say-target').textContent()) ?? '';
  await setSay(page, t2.split(' ').slice(0, 2).join(' '));
  await page.getByRole('button', { name: 'Nói thử' }).click();
  await expect(page.getByTestId('say-score')).not.toHaveText('100%');
  await expect(page.locator('[data-status="missing"]').first()).toBeVisible();
  await noHScroll(page);

  await setSay(page, 'ERR:network');
  await page.getByRole('button', { name: 'Nói lại' }).click();
  await expect(page.getByTestId('say-err')).toContainText('cần mạng');
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong lượt luyện nói');
  await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();

  // Thẻ câu mẫu: Nói thử → Chấm theo điểm.
  await page.getByRole('button', { name: /^Câu mẫu/ }).click();
  const sentence = (await page.getByTestId('pt-sentence').textContent()) ?? '';
  await setSay(page, sentence);
  await page.getByRole('button', { name: 'Nói thử' }).click();
  await expect(page.getByTestId('say-score')).toHaveText('100%');
  await page.getByRole('button', { name: /sang tự thay từ/ }).click();
  await page.getByRole('button', { name: 'Nói thử' }).click();
  await page.getByRole('button', { name: 'Chấm theo điểm · Nhớ rõ' }).click();
  await expect(page.getByTestId('sess-count')).toHaveText(/^2\//);
});

test('đề nói 1 phút: chọn 30 giây, ghi âm (audio/mp4), dừng & lưu, nghe lại, còn sau khi tải lại, xóa', async ({ page }) => {
  await page.goto('./#hom-nay');
  await page.getByRole('button', { name: /^Đề nói 1 phút/ }).click();
  await expect(page.getByRole('heading', { name: 'Đề nói 1 phút' })).toBeVisible();
  await expect(page.getByTestId('rec-empty')).toBeVisible();
  await noHScroll(page);
  await page.locator('.sh-tracks .opt').first().click();
  const title = (await page.getByTestId('topic-en').textContent()) ?? '';
  await page.getByRole('button', { name: '30 giây' }).click();
  await expect(page.getByTestId('rec-left')).toHaveText('0:30');
  await noHScroll(page);

  await page.getByRole('button', { name: 'Bắt đầu ghi âm' }).click();
  await expect(page.getByTestId('rec-status')).toContainText('Đang ghi âm');
  await expect(page.getByRole('button', { name: '60 giây' })).toBeDisabled();
  expect(await win<string>(page, '__mime')).toBe('audio/mp4');
  await expect(page.getByTestId('rec-left')).not.toHaveText('0:30', { timeout: 3000 });
  await page.getByRole('button', { name: 'Dừng & lưu' }).click();
  await expect(page.getByTestId('rec-status')).toContainText('Đã lưu bản ghi');
  expect(await win<number>(page, '__tracksStopped')).toBe(1);
  await expect(page.getByTestId('rec-item')).toHaveCount(1);
  await expect(page.getByTestId('rec-item').locator('audio')).toHaveAttribute('src', /^blob:/);
  await noHScroll(page);

  await page.reload();
  await page.getByRole('button', { name: /^Đề nói 1 phút/ }).click();
  await expect(page.getByTestId('rec-item')).toHaveCount(1);
  await expect(page.getByTestId('rec-item')).toContainText(title.slice(0, 20));
  await page.getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: 'Bấm lần nữa để xóa' }).click();
  await expect(page.getByTestId('rec-empty')).toBeVisible();
});

test('giữ thời lượng vừa chọn nếu cài đặt tiếng Anh về muộn', async ({ page }) => {
  type TestWindow = Window & { releasePrefs?: () => void };
  await page.addInitScript(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) {
      const request = get.call(this, key);
      if (this.name === 'settings' && key === 'en.prefs') {
        request.addEventListener('success', (event) => {
          event.stopImmediatePropagation();
          (window as TestWindow).releasePrefs = () => request.dispatchEvent(new Event('success'));
        }, { once: true });
      }
      return request;
    };
  });
  await page.goto('./#hom-nay');
  await page.waitForFunction(() => !!(window as TestWindow).releasePrefs);
  const fiveMinutes = page.getByRole('button', { name: 'EN 5 phút' });
  await fiveMinutes.click();
  await expect(fiveMinutes).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => (window as TestWindow).releasePrefs!());
  await page.getByRole('button', { name: /^Luyện nói/ }).click();
  await expect(page.getByTestId('sess-count')).toHaveText('1/5');
});
