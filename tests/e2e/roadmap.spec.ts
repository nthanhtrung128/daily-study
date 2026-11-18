import { expect, test } from '@playwright/test';

test('học M05 từ Hôm nay, thử tính, lưu tiến độ và học tiếp', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Mở lộ trình Total Rewards' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cấu trúc lương cơ bản');
  await page.getByRole('button', { name: /^Bắt đầu học/ }).click();
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành' }).click();
  await expect(page.getByText('1/4 bài đã hoàn thành')).toBeVisible();
  await page.getByRole('button', { name: /^Học tiếp/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Diễn giải compa và penetration');
  await page.getByRole('button', { name: 'Xem compa-ratio' }).click();
  await expect(page.getByText(/18 ÷ 20 = 90%/)).toBeVisible();
  const calculate = page.getByRole('button', { name: 'Tính vị trí trong dải' });
  await calculate.click();
  await expect(page.getByRole('status').filter({ hasText: /Nhập min dương/ })).toBeVisible();
  await page.getByLabel('Min (triệu đồng/tháng)').fill('16,0');
  await page.getByLabel('Max (triệu đồng/tháng)').fill('24');
  await calculate.click();
  await expect(page.getByText('Vị trí trong dải: 25,0%.')).toBeVisible();
  if (process.env.PW_SHOTS === 'roadmap') {
    await page.screenshot({ path: info.outputPath('m05.png'), fullPage: true });
  }
  await page.getByRole('button', { name: 'Xem lời giải' }).click();
  await expect(page.getByText(/Compa từ 90% xuống 85,7%/)).toBeVisible();
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành' }).click();
  await expect(page.getByText('2/4 bài đã hoàn thành')).toBeVisible();
  await page.reload();
  await expect(page.getByText('2/4 bài đã hoàn thành')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Học tiếp/ })).toHaveText(/Quy tắc tuyển và dịch chuyển/);
});
