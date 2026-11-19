import { expect, test, type Page } from '@playwright/test';
import { stubMedia } from './helpers/stubs';

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
const noHScroll = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
};
/** Chụp ảnh cho mô tả PR khi đặt PW_SHOTS=dictation (bình thường không chụp). */
const shot = async (page: Page, project: string, name: string) => {
  if (process.env.PW_SHOTS === 'dictation' && project === 'iPhone 14') await page.screenshot({ path: `docs/screenshots/dictation-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(stubMedia);
});

test('nghe chép: nghe → gõ → Kiểm tra → tô từ sai + điểm → hết phiên', async ({ page }, info) => {
  const P = info.project.name;
  await page.goto('./#hom-nay');
  await page.getByRole('button', { name: /^Nghe chép/ }).click();
  await expect(page.getByTestId('sess-count')).toHaveText('1/8');
  // Chưa bấm thì chưa phát âm, câu gốc không hiện.
  expect(await spoken(page)).toEqual([]);
  await expect(page.getByTestId('say-diff')).toHaveCount(0);

  const box = page.getByRole('textbox', { name: 'Gõ lại câu bạn nghe được' });
  for (const [attr, val] of Object.entries({ autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', lang: 'en', enterkeyhint: 'done' })) await expect(box).toHaveAttribute(attr, val);
  expect(await box.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await expect(page.getByRole('button', { name: 'Kiểm tra' })).toBeDisabled();

  await page.getByRole('button', { name: 'Nghe câu' }).click();
  await page.getByRole('button', { name: /^Nghe chậm/ }).click();
  await expect(page.getByTestId('dict-plays')).toHaveText('Đã nghe 2 lần');
  const heard = await spoken(page);
  expect(heard).toHaveLength(2);
  const target = heard[0] as string;
  await shot(page, P, '1-nghe');

  // Câu 1: gõ đúng (chữ thường, bỏ dấu câu, giữ dấu trong số) → 100%.
  await box.fill(target.replace(/[!?]|[.,](?!\d)/g, '').toLowerCase());
  await noHScroll(page);
  await page.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(page.getByTestId('dict-score')).toHaveText('100%');
  await page.reload();
  const resume = page.getByTestId('resume-panel');
  await expect(resume).toContainText('(1/8)');
  await resume.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByTestId('sess-count')).toHaveText('2/8');

  // Câu 2: dùng gợi ý, gõ sai từ đầu + thiếu từ cuối → tô từ sai / thiếu, điểm < 100.
  await page.getByRole('button', { name: 'Nghe câu' }).click();
  const t2 = ((await spoken(page)).at(-1) as string).split(' ');
  await page.getByRole('button', { name: /^Hiện chữ cái đầu/ }).click();
  await expect(page.getByTestId('dict-hint')).toBeVisible();
  await box.fill(['zzz', ...t2.slice(1, -1)].join(' '));
  await shot(page, P, '2-go');
  await box.press('Enter');
  await expect(page.getByTestId('dict-score')).not.toHaveText('100%');
  await expect(page.locator('[data-status="wrong"]').first()).toBeVisible();
  await expect(page.locator('[data-status="missing"]').first()).toBeVisible();
  await expect(page.getByTestId('say-diff')).toContainText(t2[0] as string);
  await noHScroll(page);
  await shot(page, P, '3-cham');
  await page.getByRole('button', { name: 'Câu tiếp' }).click();

  // Các câu còn lại: bỏ qua → màn kết quả.
  for (let k = 3; k <= 8; k++) {
    await expect(page.getByTestId('sess-count')).toHaveText(`${k}/8`);
    await page.getByRole('button', { name: 'Bỏ qua' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Xong phiên nghe chép' })).toBeVisible();
  await expect(page.getByTestId('dict-avg')).toHaveText(/^\d+%$/);
  await expect(page.getByTestId('dict-missed')).toBeVisible();
  await noHScroll(page);
  await shot(page, P, '4-ket-qua');
  await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();
  await expect(page.getByRole('button', { name: /^Nghe chép/ })).toBeVisible();
});
