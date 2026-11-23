import { expect, test } from '@playwright/test';

test('đối sánh hồ sơ M08 theo phạm vi, có thể sửa lựa chọn sau phản hồi', async ({ page }) => {
  await page.goto('/#lo-trinh?bai=trm-08-02');
  const panel = page.getByRole('region', { name: 'Chọn hồ sơ khảo sát lương' });
  await panel.getByRole('combobox').selectOption('C');
  await expect(panel.getByRole('button')).toBeDisabled();
  await panel.getByRole('textbox').fill('So sánh trách nhiệm rà soát bảng lương của cả nhóm.');
  await panel.getByRole('button').click();
  await expect(panel.getByText(/Mẫu mới và P50 thấp hơn/)).toBeVisible();
  await panel.getByRole('combobox').selectOption('B');
  await expect(panel.getByText(/Mẫu mới và P50 thấp hơn/)).toHaveCount(0);
  await panel.getByRole('button').click();
  await expect(panel.getByRole('heading', { name: 'Đã chọn đúng hồ sơ tham chiếu' })).toBeFocused();
});
