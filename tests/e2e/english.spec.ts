import { expect, test, type Page } from '@playwright/test';

/** speechSynthesis giả: ghi lại câu được đọc vào window.__spoken, tự bắn end sau 50 ms. */
const stubSpeech = () => {
  const w = window as unknown as { __spoken: string[]; speechSynthesis: unknown; SpeechSynthesisUtterance: unknown };
  w.__spoken = [];
  const voices = [
    { name: 'Samantha', lang: 'en-US', localService: true, default: false, voiceURI: 'sam' },
    { name: 'Daniel', lang: 'en-GB', localService: true, default: false, voiceURI: 'dan' },
  ];
  class U {
    lang = '';
    rate = 1;
    pitch = 1;
    voice: unknown = null;
    onend: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    constructor(public text: string) {}
  }
  let cur: U | null = null;
  const synth = {
    speak(u: U) {
      cur = u;
      w.__spoken.push(u.text);
      setTimeout(() => {
        if (cur === u) u.onend?.({});
      }, 50);
    },
    cancel() {
      const u = cur;
      cur = null;
      u?.onerror?.({ error: 'interrupted' });
    },
    getVoices: () => voices,
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: U, configurable: true });
};

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

const noHScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(stubSpeech);
});

test('thẻ từ: nghe phát âm khi bấm, lật thẻ, chấm Nhớ rõ → thẻ 2; tiến độ EN giữ sau khi tải lại', async ({ page }) => {
  await page.goto('./#hom-nay');
  await expect(page.getByRole('heading', { name: 'Luyện nói công sở' })).toBeVisible();
  await noHScroll(page);
  await page.getByRole('button', { name: 'EN 5 phút' }).click();
  await page.getByRole('button', { name: /^Thẻ từ/ }).click();

  const count = page.getByTestId('sess-count');
  await expect(count).toHaveText('1/10');
  expect(await spoken(page)).toEqual([]);
  const phrase = (await page.locator('.en-card h2').textContent()) ?? '';
  await page.getByRole('button', { name: `Nghe: ${phrase}` }).click();
  await expect.poll(() => spoken(page)).toEqual([phrase]);

  await page.getByRole('button', { name: 'Lật thẻ' }).click();
  await expect(page.getByText('Ví dụ', { exact: true })).toBeVisible();
  await noHScroll(page);
  await page.getByRole('button', { name: /Nhớ rõ/ }).click();
  await expect(count).toHaveText('2/10');
  await page.getByRole('button', { name: 'Lật thẻ' }).click();
  await page.getByRole('button', { name: /Quên/ }).click();
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong phiên tiếng Anh');
  await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();
  await expect(page.getByTestId('en-due')).toHaveText('1');

  await page.reload();
  await expect(page.getByTestId('en-due')).toHaveText('1');
  await expect(page.getByTestId('streak')).toHaveText('1');
});

test('câu mẫu: nghe → nhại → đổi slot, đọc lại câu đã thay; shadowing phát được', async ({ page }) => {
  await page.goto('./#hom-nay');
  await page.getByRole('button', { name: /^Câu mẫu/ }).click();
  const sentence = page.getByTestId('pt-sentence');
  const original = (await sentence.textContent()) ?? '';
  await page.getByRole('button', { name: /^Nghe câu:/ }).click();
  await page.getByRole('button', { name: /sang tự thay từ/ }).click();

  const chip = page.getByRole('group', { name: 'Chỗ thay 1' }).getByRole('button').nth(1);
  const alt = (await chip.textContent()) ?? '';
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(sentence).toContainText(alt);
  await expect(sentence.locator('.slot.changed')).toHaveCount(1);
  await noHScroll(page);
  await page.getByRole('button', { name: /^Nghe câu đã thay/ }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)).toContain(alt);
  expect((await spoken(page))[0]).toBe(original);
  await page.getByRole('button', { name: /Nhớ rõ/ }).click();
  await expect(page.getByTestId('sess-count')).toHaveText(/^2\//);
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();

  await page.getByRole('button', { name: /^Shadowing/ }).click();
  await page.getByRole('button', { name: /Họp · phần 1/ }).click();
  await page.getByRole('button', { name: 'Phát' }).click();
  await expect(page.getByTestId('sh-status')).toHaveText(/Đang đọc|Đến lượt bạn nhại/);
  await page.getByRole('button', { name: 'Câu sau' }).click();
  await expect(page.getByTestId('sh-count')).toHaveText('2/10');
  await page.getByRole('button', { name: '0,75×' }).click();
  await expect(page.getByRole('button', { name: '0,75×' })).toHaveAttribute('aria-pressed', 'true');
  await noHScroll(page);
  await page.getByRole('button', { name: 'Tạm dừng' }).click();
  await expect(page.getByTestId('sh-status')).toHaveText('Đã dừng.');
});
