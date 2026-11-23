import { expect, test } from '@playwright/test';
test('so sánh tiền bảo đảm, hai kịch bản thưởng và điều khoản cần thương lượng', async ({ page }) => {
  await page.goto('/#lo-trinh');
  await page.getByRole('link', { name: 'So sánh hai thư mời' }).click();
  const panel = page.getByRole('region', { name: 'So sánh hai thư mời' });
  const fields = panel.getByRole('textbox');
  for (const [i, v] of ['408', '420', '465,6', '462', '422,4', '430,5', 'B có bảo đảm 420 triệu.', 'When does family cover begin?'].entries()) await fields.nth(i).fill(v);
  await panel.getByRole('radio', { name: 'Thư B' }).check();
  await panel.getByRole('radio', { name: 'Đã hỏi được' }).check();
  await panel.getByRole('button', { name: 'Lưu so sánh và xem đáp án' }).click();
  await expect(panel).toContainText('Bản so sánh đã lưu');
  await page.reload();
  await expect(panel).toContainText('Tính thưởng và thu nhập khi hụt mục tiêu · Đạt');
  await expect(panel).toContainText('When does family cover begin?');
});
