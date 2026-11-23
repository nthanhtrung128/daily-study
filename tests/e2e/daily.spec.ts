import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

/** Stub speechSynthesis + webkitSpeechRecognition (trả về window.__nextSay sau 80 ms). Chạy trước mã trang. */
const stubSpeech = () => {
  const w = window as unknown as { __spoken: string[]; __nextSay: string };
  w.__spoken = [];
  w.__nextSay = '';
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
      w.__spoken.push(`${u.lang}|${u.rate}|${u.text}`);
      setTimeout(() => u.onend?.({}), 30);
    },
    cancel() {},
    getVoices: () => [
      { name: 'Samantha', lang: 'en-US', localService: true, default: false, voiceURI: 'sam' },
      { name: 'Daniel', lang: 'en-GB', localService: true, default: false, voiceURI: 'dan' },
    ],
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
      this.live = true;
      const say = w.__nextSay;
      setTimeout(() => {
        if (!this.live) return;
        if (say) this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: say }], { isFinal: true })] });
        this.stop();
      }, 80);
    }
    stop() {
      if (!this.live) return;
      this.live = false;
      setTimeout(() => this.onend?.(), 10);
    }
    abort() {
      this.stop();
    }
  }
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: Rec, configurable: true });
};

const noHScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

/** Trả lời mục đang hiện, bất kể loại. */
async function answer(page: Page, k: number) {
  const btn = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
  const has = async (name: string | RegExp) => (await btn(name).count()) > 0;
  const grade = k % 4 === 3 ? /Quên/ : /Nhớ rõ/;
  if ((await page.getByTestId('say-target').count()) > 0) {
    const target = (await page.getByTestId('say-target').textContent()) ?? '';
    await page.evaluate((s) => ((window as unknown as { __nextSay: string }).__nextSay = s), target.replace(/[.,!?]/g, ''));
    await btn('Nói thử').click();
    await btn(/^Tiếp · /).click();
    return 'say';
  }
  if (await has('Xong đề nói · tiếp')) {
    await btn('Xong đề nói · tiếp').click();
    return 'topic';
  }
  for (const flip of ['Lật thẻ', 'Xem gợi ý & tự chấm', 'Xem nghĩa', 'Đã nhại · sang tự thay từ']) {
    if (await has(flip)) {
      await btn(flip).click();
      await btn(grade).click();
      return flip;
    }
  }
  if ((await page.locator('.card .opt').count()) > 0) {
    await page.locator('.card .opt').first().click();
    await btn('Câu tiếp').click();
    return 'quiz';
  }
  if ((await page.getByLabel('Đáp số').count()) > 0) {
    await page.getByLabel('Đáp số').fill('1.530');
    await btn('Kiểm tra').click();
    await btn('Câu tiếp').click();
    return 'calc';
  }
  throw new Error('Không nhận ra loại mục');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(stubSpeech);
});

test('phiên hằng ngày 10 phút: TR + EN xen kẽ, có câu nói có chấm, chạy hết đến màn kết quả; chuỗi ngày cập nhật', async ({ page }) => {
  await page.goto('./#hom-nay');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trung tâm học tập');
  await expect(page.getByTestId('streak')).toHaveText('0');
  await page.getByRole('group', { name: 'Thời lượng phiên hôm nay' }).getByRole('button', { name: '10 phút' }).click();
  await expect(page.getByTestId('daily-sum')).toContainText('1 câu nói có chấm');
  await noHScroll(page);
  await page.getByRole('button', { name: 'Bắt đầu ôn hôm nay' }).click();

  const count = page.getByTestId('sess-count');
  await expect(count).toHaveText(/^1\/\d+$/);
  const total = Number((await count.textContent())?.split('/')[1]);
  expect(total).toBeGreaterThan(6);
  const lanes: string[] = [];
  const kinds: string[] = [];
  for (let k = 0; k < total; k++) {
    await expect(count).toHaveText(`${k + 1}/${total}`);
    lanes.push((await page.getByTestId('mix-lane').getAttribute('data-lane')) ?? '');
    if (k < 3) await noHScroll(page);
    kinds.push(await answer(page, k));
  }
  expect(lanes).toContain('tr');
  expect(lanes).toContain('en');
  expect(kinds).toContain('say');
  // Không quá 3 mục liên tiếp cùng phần (bài nói tính là EN).
  const norm = lanes.map((l) => (l === 'speak' ? 'en' : l));
  let run = 1;
  for (let i = 1; i < norm.length; i++) {
    run = norm[i] === norm[i - 1] ? run + 1 : 1;
    expect(run).toBeLessThanOrEqual(3);
  }

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong phiên hôm nay');
  await expect(page.getByTestId('mix-row-tr')).toBeVisible();
  await expect(page.getByTestId('mix-row-en')).toBeVisible();
  await expect(page.getByTestId('mix-speak')).toContainText('đã làm 1 bài');
  await expect(page.getByText('Cần ôn lại')).toBeVisible();
  await expect(page.getByTestId('streak')).toHaveText('1');
  await noHScroll(page);

  await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();
  await expect(page.getByTestId('st-today')).toHaveText(String(total));
  await page.reload();
  await expect(page.getByTestId('streak')).toHaveText('1');
  await expect(page.getByRole('group', { name: 'Thời lượng phiên hôm nay' }).getByRole('button', { name: '10 phút' })).toHaveAttribute('aria-pressed', 'true');
});

test('Cài đặt: đổi tỉ lệ, mục mới, giọng đọc → lưu sau khi tải lại; tải file nhắc lịch .ics', async ({ page }) => {
  await page.goto('./#cai-dat');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cài đặt');
  await noHScroll(page);
  await page.getByLabel('Tỉ lệ thời gian TR / tiếng Anh').fill('70');
  await expect(page.getByTestId('share-val')).toHaveText('TR 70% · Tiếng Anh 30%');
  await page.getByRole('group', { name: 'Số mục mới tối đa mỗi ngày' }).getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: 'Giọng Anh' }).click();
  await page.getByRole('button', { name: '1×' }).click();
  await page.getByRole('button', { name: 'Nghe thử' }).click();
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(spoken.at(-1)).toMatch(/^en-GB\|1\|/);

  await page.getByLabel('Giờ nhắc').fill('06:45');
  const days = page.getByRole('group', { name: 'Ngày nhắc' });
  await days.getByRole('button', { name: 'Chủ nhật' }).click();
  await expect(days.getByRole('button', { name: 'Chủ nhật' })).toHaveAttribute('aria-pressed', 'false');
  await noHScroll(page);

  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải file nhắc lịch (.ics)' }).click()]);
  expect(dl.suggestedFilename()).toBe('nhac-on-luyen.ics');
  const ics = await readFile((await dl.path()) as string, 'utf8');
  expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(ics).toContain('RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=MO,TU,WE,TH,FR,SA\r\n');
  expect(ics).toMatch(/DTSTART;TZID=Asia\/Bangkok:\d{8}T064500\r\n/);
  expect(ics).toContain('BEGIN:VALARM');
  for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
  await expect(page.getByTestId('ics-msg')).toContainText('nhắc lúc 06:45');

  await page.reload();
  await expect(page.getByTestId('share-val')).toHaveText('TR 70% · Tiếng Anh 30%');
  await expect(page.getByRole('button', { name: 'Giọng Anh' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Giờ nhắc')).toHaveValue('06:45');
  await page.getByRole('link', { name: 'Hôm nay', exact: true }).click();
  await expect(page.getByText(/TR 70% · Tiếng Anh 30%/)).toBeVisible();
  await expect(page.getByText(/còn 10\/10 mục mới/)).toBeVisible();
});

test('tiếp tục phiên dở: tải lại trang giữa phiên trộn → "Tiếp tục" mở đúng câu tiếp theo', async ({ page }) => {
  await page.goto('./#hom-nay');
  await page.getByRole('group', { name: 'Thời lượng phiên hôm nay' }).getByRole('button', { name: '10 phút' }).click();
  await page.getByRole('button', { name: 'Bắt đầu ôn hôm nay' }).click();
  const count = page.getByTestId('sess-count');
  await expect(count).toHaveText(/^1\/\d+$/);
  const total = Number((await count.textContent())?.split('/')[1]);
  for (let k = 0; k < 3; k++) {
    await expect(count).toHaveText(`${k + 1}/${total}`);
    await answer(page, k);
  }
  await expect(count).toHaveText(`4/${total}`);
  const lane = await page.getByTestId('mix-lane').getAttribute('data-lane');
  const card = await page.locator('.card').first().innerText();

  await page.reload();
  const panel = page.getByTestId('resume-panel');
  await expect(panel).toContainText(`Bạn đang ôn dở (3/${total})`);
  await noHScroll(page);
  await panel.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(count).toHaveText(`4/${total}`);
  await expect(page.getByTestId('mix-lane')).toHaveAttribute('data-lane', lane ?? '');
  expect((await page.locator('.card').first().innerText()).slice(0, 40)).toBe(card.slice(0, 40));
  await answer(page, 3);
  await expect(count).toHaveText(`5/${total}`);

  // Kết thúc → xóa phiên dở.
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong phiên hôm nay');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trung tâm học tập');
  await expect(page.getByTestId('resume-panel')).toHaveCount(0);
});

test('bật nghe chép trong phiên hằng ngày, tiếp tục đúng vị trí sau khi chấm', async ({ page }) => {
  test.slow();
  await page.goto('./#cai-dat');
  const dict = page.getByRole('button', { name: 'Nghe chép trong phiên hằng ngày' });
  await expect(dict).toHaveAttribute('aria-pressed', 'false');
  await dict.click();
  await page.getByRole('group', { name: 'Số mục mới tối đa mỗi ngày' }).getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('link', { name: 'Hôm nay', exact: true }).click();
  await page.getByRole('group', { name: 'Thời lượng phiên hôm nay' }).getByRole('button', { name: '10 phút' }).click();
  await page.getByRole('button', { name: 'Bắt đầu ôn hôm nay' }).click();
  const box = page.getByRole('textbox', { name: 'Gõ lại câu bạn nghe được' });
  const count = page.getByTestId('sess-count');
  const total = Number((await count.textContent())?.split('/')[1]);
  let at = 0;
  while (at < total && !(await box.count())) {
    await answer(page, at);
    at++;
  }
  await expect(box).toBeVisible();
  await page.getByRole('button', { name: 'Nghe câu' }).click();
  const heard = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.at(-1)?.split('|').at(-1) ?? '');
  await box.fill(heard);
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(page.getByTestId('dict-score')).toHaveText('100%');
  await page.reload();
  const resume = page.getByTestId('resume-panel');
  await expect(resume).toContainText(`(${at + 1}/${total})`);
  await resume.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(count).toHaveText(`${at + 2}/${total}`);
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await expect(page.getByTestId('mix-dict')).toContainText('100%');
});
