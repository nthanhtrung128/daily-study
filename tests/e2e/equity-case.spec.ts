import { expect, test } from '@playwright/test';
test('lập phiếu công bằng lương, loại hồ sơ bán thời gian và xem lại sau tải trang', async ({ page }) => {
  await page.goto('/#lo-trinh');
  await page.getByRole('link', { name: 'Điều tra công bằng lương nội bộ' }).click();
  const panel = page.getByRole('region', { name: 'Hồ sơ công bằng lương' });
  await panel.getByRole('checkbox', { name: /^E02/ }).check();
  await panel.getByRole('checkbox', { name: /^E03/ }).check();
  await panel.getByRole('radio', { name: 'E01' }).check();
  const fields = panel.getByRole('textbox');
  for (const [i, question] of ['Ai duyệt hàng?', 'Lần tăng gần nhất?', 'Đã quy đổi FTE?'].entries()) await fields.nth(i).fill(question);
  await panel.getByRole('radio', { name: 'Cần luyện thêm' }).check();
  await panel.getByRole('button', { name: 'Lưu phiếu và đối chiếu' }).click();
  await expect(panel).toContainText('Phiếu điều tra đã lưu');
  await page.reload();
  await expect(panel).toContainText('Chọn đúng nhóm đối sánh · Đạt');
  await expect(panel).toContainText('Đã quy đổi FTE?');
});
