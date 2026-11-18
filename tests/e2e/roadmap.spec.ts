import { expect, test } from '@playwright/test';
import { audit, openTab } from './helpers/audit';
import { watchCsp } from './helpers/stubs';

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

test('mở thẻ M05, hẹn ôn hoặc bỏ hẹn rồi chấm thẻ đã chọn ở Hôm nay', async ({ page }, info) => {
  await page.addInitScript(watchCsp);
  await page.goto('./#lo-trinh');
  await page.getByRole('button', { name: 'Diễn giải compa và penetration' }).click();
  const related = page.getByRole('region', { name: 'Thẻ liên quan' });
  const compa = related.locator('details').filter({ has: page.getByText('Compa-ratio', { exact: true }) });
  await expect(related.getByRole('button', { name: 'Đưa vào lịch ôn', includeHidden: true })).toHaveCount(0);
  await compa.locator('summary').click();
  await expect(compa.locator('.formula')).toBeVisible();
  await compa.getByRole('button', { name: 'Đưa vào lịch ôn' }).click();
  await expect(compa.getByRole('status')).toHaveText('Đã lên lịch');
  const found: string[] = [];
  await audit(page, 'm05-the-lien-quan', found);
  expect(found).toEqual([]);
  if (process.env.PW_SHOTS === 'roadmap' && info.project.name === 'iPhone SE') {
    await related.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: info.outputPath('m05-the-lien-quan.png') });
  }
  const range = related.locator('details').filter({ has: page.getByText('Range penetration', { exact: true }) });
  await range.locator('summary').click();
  await range.getByRole('button', { name: 'Đưa vào lịch ôn' }).click();
  await expect(range.getByRole('status')).toHaveText('Đã lên lịch');
  await range.getByRole('button', { name: 'Bỏ khỏi lịch ôn' }).click();
  await expect(range.getByRole('button', { name: 'Đưa vào lịch ôn' })).toBeEnabled();

  await openTab(page, 'hom-nay');
  const review = page.getByRole('button', { name: 'Ôn 1 thẻ từ bài đọc' });
  await expect(review).toBeVisible();
  await expect(page.getByTestId('st-today')).toHaveText('0');
  await page.reload();
  await review.click();
  await expect(page.getByRole('heading', { name: 'Compa-ratio' })).toBeVisible();
  await page.getByRole('button', { name: 'Lật thẻ' }).click();
  await page.getByRole('button', { name: /^Nhớ rõ/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong phiên ôn hôm nay');
  await page.reload();
  await expect(page.getByTestId('st-today')).toHaveText('1');
  await expect(review).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('đọc M06 và cân cả ma trận merit theo ngân sách', async ({ page }, info) => {
  await page.addInitScript(watchCsp);
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
  const band = page.getByRole('group', { name: 'Vùng compa' }).getByRole('button', { name: '90–110%', exact: true });
  await band.click();
  await expect(band).toHaveAttribute('aria-pressed', 'true');
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
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  await page.reload();
  await expect(module.getByText('1/4 bài đã hoàn thành')).toBeVisible();
});

test('đọc M09 và so sánh lương theo FTE, grade và họ nghề', async ({ page }, info) => {
  await page.addInitScript(watchCsp);
  await page.goto('./#lo-trinh');
  const module = page.getByRole('region', { name: 'Phân tích dữ liệu đãi ngộ' });
  await module.getByRole('button', { name: 'Đọc phân bố và nguyên nhân' }).click();
  await expect(page.getByRole('heading', { name: 'Bối cảnh nghiệp vụ' })).toBeVisible();
  const coverage = page.getByTestId('salary-coverage');
  const group = page.getByTestId('salary-group');
  await expect(coverage).toContainText('12/12 hồ sơ đủ dữ liệu tính compa');
  await expect(group).toContainText('100,86%');
  await expect(group).toContainText('99,57%');
  await page.getByRole('group', { name: 'Grade', exact: true }).getByRole('button', { name: 'G1', exact: true }).click();
  await expect(coverage).toContainText('4/4 hồ sơ đủ dữ liệu tính compa');
  await expect(group).toContainText('91,25%');
  await page.getByText(/^Hồ sơ mẫu · NV01/).click();
  await page.getByRole('button', { name: /^NV04 ·/ }).click();
  await expect(page.getByTestId('salary-detail')).toContainText('20,00 triệu');
  if (process.env.PW_SHOTS === 'roadmap' && info.project.name === 'iPhone SE') {
    await group.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: info.outputPath('m09.png') });
  }
  await page.getByLabel('Midpoint tại 1 FTE').fill('');
  await expect(coverage).toContainText('3/4 hồ sơ đủ dữ liệu tính compa');
  await expect(group).toContainText('88,33%');
  await page.getByRole('group', { name: 'Họ nghề', exact: true }).getByRole('button', { name: 'Kinh doanh', exact: true }).click();
  await expect(page.getByText(/Tổ hợp grade và họ nghề này chưa có hồ sơ/)).toBeVisible();
  await page.getByRole('button', { name: 'Khôi phục bảng mẫu' }).click();
  await expect(coverage).toContainText('12/12 hồ sơ đủ dữ liệu tính compa');
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành' }).click();
  await expect(module.getByText('1/4 bài đã hoàn thành')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  await page.reload();
  await expect(module.getByText('1/4 bài đã hoàn thành')).toBeVisible();
});
