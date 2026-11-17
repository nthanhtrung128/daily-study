import { expect, test, type Page } from '@playwright/test';
import { stubMedia } from './helpers/stubs';

type W = { __spoken: string[]; __nextSay: string; __recStarts: number };
const spoken = (page: Page) => page.evaluate(() => (window as unknown as W).__spoken);
const nextSay = (page: Page, s: string) => page.evaluate((v) => ((window as unknown as W).__nextSay = v), s);
const noHScroll = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
};
/** Chụp ảnh cho mô tả PR khi đặt PW_SHOTS=roleplay (bình thường không chụp). */
const shot = async (page: Page, project: string, name: string) => {
  if (process.env.PW_SHOTS !== 'roleplay' || project !== 'iPhone 14') return;
  await page.waitForTimeout(350); // chờ hiệu ứng bấm xong
  await page.screenshot({ path: `docs/screenshots/roleplay-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(stubMedia);
});

test('nhập vai: chọn hội thoại + vai → app đọc → nói → điểm → hết bài → kết quả', async ({ page }, info) => {
  const P = info.project.name;
  await page.goto('./#hom-nay');
  await page.getByRole('button', { name: /^Nhập vai/ }).click();
  await expect(page.getByRole('heading', { name: 'Nhập vai' })).toBeVisible();

  // Lọc theo chủ đề + trình độ rồi chọn bài.
  await page.getByRole('button', { name: 'Họp', exact: true }).click();
  await page.getByRole('button', { name: 'B2', exact: true }).click();
  await noHScroll(page);
  await shot(page, P, '1-chon-bai');
  await page.getByRole('button', { name: /^Presenting survey results to the HR director/ }).click();

  // Vai mặc định: Chuyên viên C&B. Đổi sang vai kia để app nói trước.
  await expect(page.getByRole('button', { name: 'A · Chuyên viên C&B' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'B · Giám đốc nhân sự' }).click();
  await noHScroll(page);
  await shot(page, P, '2-chon-vai');
  expect(await spoken(page)).toEqual([]); // chưa bấm thì chưa đọc
  await page.getByRole('button', { name: 'Bắt đầu' }).click();

  // App đọc 2 câu của vai A nối tiếp rồi dừng ở lượt của người học.
  const target = page.getByTestId('rp-target');
  await expect(target).toHaveText("So we're slightly below the median.");
  expect(await spoken(page)).toEqual(["I'd like to share the main findings from this year's salary survey.", 'Overall, our base pay is at about the 45th percentile.']);
  expect(await page.evaluate(() => (window as unknown as W).__recStarts)).toBe(0);
  const mic = page.getByRole('button', { name: 'Bấm để nói' });
  expect((await mic.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await noHScroll(page);
  await shot(page, P, '3-luot-cua-ban');

  // Lượt 1: nói đúng → 100%.
  await nextSay(page, "so we're slightly below the median");
  await mic.click();
  await expect(page.getByTestId('rp-score')).toHaveText('100%');
  await expect(page.getByRole('button', { name: 'Nói lại' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nghe mẫu' })).toBeVisible();
  await page.getByRole('button', { name: /^Tiếp/ }).click();

  // Lượt 2: nói sai → điểm thấp, tô từ sai / thiếu.
  await expect(target).toHaveText('Which roles are furthest behind?');
  await nextSay(page, 'which rules');
  await mic.click();
  await expect(page.getByTestId('rp-score')).not.toHaveText('100%');
  await expect(page.locator('[data-status="missing"]').first()).toBeVisible();
  await noHScroll(page);
  await shot(page, P, '4-cham-diem');
  await page.getByRole('button', { name: /^Tiếp/ }).click();

  // Ba lượt còn lại: nói đúng theo câu đang hiện.
  for (let k = 3; k <= 5; k++) {
    await expect(target).toBeVisible();
    await nextSay(page, (await target.textContent()) ?? '');
    await mic.click();
    await expect(page.getByTestId('rp-score')).toHaveText('100%');
    await page.getByRole('button', { name: k === 5 ? /^Xem kết quả/ : /^Tiếp/ }).click();
  }

  await expect(page.getByRole('heading', { name: 'Xong hội thoại' })).toBeVisible();
  await expect(page.getByTestId('rp-avg')).toHaveText(/^\d+%$/);
  await expect(page.getByTestId('rp-weak').locator('details')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Luyện lại 1 câu điểm thấp' })).toBeVisible();
  expect((await spoken(page)).length).toBe(6); // 6 câu của vai A
  await noHScroll(page);
  await shot(page, P, '5-ket-qua');

  // Bài đã luyện được đánh dấu kèm điểm; về Hôm nay.
  await page.getByRole('button', { name: 'Chọn bài khác' }).click();
  await expect(page.getByRole('button', { name: /^Presenting survey results/ })).toContainText(/Đã luyện · \d+%/);
  await page.getByRole('button', { name: 'Xong' }).click();
  await expect(page.getByRole('button', { name: /^Nhập vai/ })).toBeVisible();
});
