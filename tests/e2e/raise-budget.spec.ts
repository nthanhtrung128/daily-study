import { expect, test } from '@playwright/test';

test('dự đoán hai chi phí, chọn phương án và thử tháng hiệu lực khác', async ({ page }) => {
  await page.goto('/#lo-trinh?bai=trm-10-02');
  const panel = page.getByRole('region', { name: 'Dự toán ngân sách tăng lương' });
  const year = panel.getByLabel(/Dự đoán chi phí tăng trong năm/);
  const full = panel.getByLabel(/Dự đoán chi phí tăng đủ/);
  await expect(panel.getByRole('button')).toBeDisabled();
  await year.fill('180'); await full.fill('360'); await panel.getByRole('button').click();
  await panel.getByRole('radio', { name: 'A', exact: true }).check();
  await expect(panel.getByText(/Số vượt quỹ 60,00 triệu/)).toBeVisible();
  await panel.getByRole('radio', { name: 'B', exact: true }).check();
  await expect(panel.getByText(/Quyết định phù hợp/)).toBeVisible();
  await panel.getByRole('combobox').selectOption('12');
  await expect(year).toHaveValue('');
  await expect(panel.getByRole('radio')).toHaveCount(0);
});
