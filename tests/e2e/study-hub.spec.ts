import { expect, test } from '@playwright/test';

test('lưu bản nháp và tiếp tục đúng đề xuất từ trung tâm học tập', async ({ page }) => {
  await page.goto('/#lo-trinh?tong-ket=1');
  await page.getByRole('radio', { name: /^Y ·/ }).check();
  await page.getByLabel('A trong năm').fill('96');
  await page.getByLabel(/^Viết đề xuất/).fill('Tôi sẽ kiểm tra ca.');
  await page.getByRole('link', { name: 'Hôm nay', exact: true }).click();
  const hub = page.getByRole('region', { name: 'Trung tâm học tập', exact: true }).last();
  await expect(hub.getByRole('link', { name: 'Bài đọc song ngữ' })).toHaveAttribute('href', '#doc-them');
  await page.reload();
  await page.getByRole('link', { name: 'Tiếp tục đề xuất giữ người' }).click();
  await expect(page.getByRole('radio', { name: /^Y ·/ })).toBeChecked();
  await expect(page.getByLabel('A trong năm')).toHaveValue('96');
  await expect(page.getByLabel(/^Viết đề xuất/)).toHaveValue('Tôi sẽ kiểm tra ca.');
});
