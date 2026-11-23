import { expect, test } from '@playwright/test';
import { stubMedia } from './helpers/stubs';

test('hai lượt nói với CFO có thể ghi riêng, so sánh và nghe lại sau khi tải trang', async ({ page }) => {
  test.slow();
  await page.addInitScript(stubMedia);
  await page.goto('/#lo-trinh?bai=trm-11-02');
  const panel = page.getByRole('region', { name: 'Bảo vệ đề xuất trước CFO' });
  for (const next of ['Tiếp đến câu hỏi CFO', 'Đối chiếu hai lượt nói']) {
    if (next.startsWith('Đối')) await panel.getByRole('button', { name: 'Nghe câu hỏi của CFO' }).click();
    await panel.getByRole('button', { name: 'Mở ghi âm lượt này' }).click();
    await panel.getByRole('button', { name: 'Bắt đầu ghi âm' }).click();
    await expect(panel.getByRole('button', { name: next })).toBeDisabled();
    await panel.getByRole('button', { name: 'Dừng & lưu' }).click();
    await expect(panel.getByTestId('rec-status')).toContainText('Đã lưu');
    await panel.getByRole('button', { name: next }).click();
  }
  await expect(panel.getByTestId('rec-item')).toHaveCount(2);
  await page.reload();
  await panel.getByRole('button', { name: '3. Nghe lại' }).click();
  await expect(panel.getByTestId('rec-item')).toHaveCount(2);
});
