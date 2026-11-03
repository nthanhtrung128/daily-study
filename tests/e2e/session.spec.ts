import { expect, test, type Page } from '@playwright/test';

const noHScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test('phiên ôn thẻ ghi nhớ: lật, chấm, kết thúc; số liệu và chuỗi ngày cập nhật, giữ sau khi tải lại', async ({ page }) => {
  await page.goto('./#hom-nay');
  await expect(page.getByTestId('streak')).toHaveText('0');
  await page.getByRole('button', { name: '5 phút', exact: true }).click();
  await page.getByRole('button', { name: 'Thẻ ghi nhớ' }).click();
  await page.getByRole('button', { name: 'Bắt đầu 5 phút' }).click();

  const count = page.getByTestId('sess-count');
  await expect(count).toHaveText(/^1\/\d+$/);
  await noHScroll(page);
  await page.getByRole('button', { name: 'Lật thẻ' }).click();
  await page.getByRole('button', { name: /Nhớ rõ/ }).click();
  await expect(count).toHaveText(/^2\/\d+$/);
  await page.getByRole('button', { name: 'Lật thẻ' }).click();
  await page.getByRole('button', { name: /Quên/ }).click();
  await expect(count).toHaveText(/^3\/\d+$/);
  await noHScroll(page);
  await page.getByRole('button', { name: 'Kết thúc' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong phiên ôn hôm nay');
  await expect(page.getByTestId('streak')).toHaveText('1');
  await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();
  await expect(page.getByTestId('st-today')).toHaveText('2');
  await expect(page.getByTestId('st-wrong')).toHaveText('1');

  await page.reload();
  await expect(page.getByTestId('st-today')).toHaveText('2');
  await expect(page.getByTestId('streak')).toHaveText('1');
  // Thời lượng và cách ôn đã chọn được nhớ.
  await expect(page.getByRole('button', { name: 'Thẻ ghi nhớ' })).toHaveAttribute('aria-pressed', 'true');
});

test('trắc nghiệm và bài tính: chọn đáp án, nhập số kiểu Việt Nam', async ({ page }) => {
  await page.goto('./#hom-nay');
  await page.getByRole('button', { name: '5 phút', exact: true }).click();
  await page.getByRole('button', { name: 'Trắc nghiệm', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu 5 phút' }).click();
  await page.locator('.opt').first().click();
  await expect(page.locator('.fb')).toBeVisible();
  await expect(page.locator('.opt.ok')).toHaveCount(1);
  await noHScroll(page);
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();

  await page.getByRole('button', { name: 'Bài tính', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu 5 phút' }).click();
  await page.getByLabel('Đáp số').fill('1.530,5');
  await page.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(page.locator('.fb')).toContainText(/Đúng|Chưa đúng/);
  await expect(page.getByLabel('Đáp số')).toBeDisabled();
  await noHScroll(page);
  await page.getByRole('button', { name: 'Câu tiếp' }).click();
  await expect(page.getByTestId('sess-count')).toHaveText(/^2\/\d+$/);
});
