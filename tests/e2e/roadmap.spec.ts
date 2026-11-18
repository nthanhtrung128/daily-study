import { expect, test } from '@playwright/test';

test('học M05 từ Hôm nay, thử tính, lưu tiến độ và học tiếp', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Mở lộ trình Total Rewards' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đọc và tự ôn Total Rewards');
  const module = page.getByRole('region', { name: 'Cấu trúc lương cơ bản' });
  await module.getByRole('button', { name: /^Bắt đầu học/ }).click();
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
    await page.evaluate(() => window.scrollTo(0, 0));
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

test('đọc M06 và cân cả ma trận merit theo ngân sách', async ({ page }, info) => {
  await page.goto('./#lo-trinh');
  const module = page.getByRole('region', { name: 'Hiệu suất và trả lương theo thành tích' });
  await module.getByRole('button', { name: 'Thiết kế ma trận merit' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thiết kế ma trận merit');
  await expect(page.getByRole('heading', { name: 'Bối cảnh nghiệp vụ' })).toBeVisible();
  await expect(page.getByTestId('merit-summary')).toContainText(/Tăng gốc 51,20.*Ngân sách 50,00/);
  const result = page.getByTestId('merit-balanced');
  await expect(result).toContainText(/50,00 triệu\/tháng.*300,00 triệu\/6 tháng/);
  await page.getByLabel('Ngân sách (%)').fill('4,5');
  await expect(result).toContainText(/45,00 triệu\/tháng.*270,00 triệu\/6 tháng/);
  const month = page.getByLabel('Số tháng hiệu lực');
  await month.fill('13');
  await expect(result).toHaveCount(0);
  await month.fill('3');
  await expect(result).toContainText('135,00 triệu/3 tháng');
  await page.getByLabel('Ô trong ma trận').selectOption('1');
  await page.getByLabel('Quỹ ô (triệu đồng/tháng)').fill('200');
  await expect(result).toContainText('45,90 triệu/tháng');
  await page.getByRole('button', { name: 'Khôi phục số liệu mẫu' }).click();
  await expect(result).toContainText('300,00 triệu/6 tháng');
  await page.getByRole('button', { name: 'Xem lời giải' }).click();
  await expect(page.getByText(/Tổng tăng 52 triệu/)).toBeVisible();
  if (process.env.PW_SHOTS === 'roadmap' && info.project.name === 'iPhone SE') {
    await page.locator('#merit-title').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: info.outputPath('m06.png') });
  }
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành' }).click();
  await expect(module.getByText('1/4 bài đã hoàn thành')).toBeVisible();
  await page.reload();
  await expect(module.getByText('1/4 bài đã hoàn thành')).toBeVisible();
});
