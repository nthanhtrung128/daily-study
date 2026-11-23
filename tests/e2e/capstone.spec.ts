import { expect, test } from '@playwright/test';

import { audit } from './helpers/audit';

test('từ bài cuối tới đề xuất tổng hợp, phân biệt điểm khách quan và tự đánh giá', async ({ page }) => {
  await page.goto('/#lo-trinh?bai=trm-17-04');
  await page.getByRole('link', { name: 'Làm bài tổng hợp cuối khóa' }).click();
  const panel = page.getByRole('region', { name: 'Bài tổng hợp cuối khóa' });
  const save = panel.getByRole('button', { name: 'Lưu đề xuất và đối chiếu' });
  await expect(save).toBeDisabled();
  const findings: string[] = [];
  await audit(page, 'bai-tong-hop', findings);
  expect(findings).toEqual([]);
  await panel.getByRole('radio', { name: /^Y ·/ }).check();
  for (const [label, value] of [['A trong năm', '96'], ['A đủ 12 tháng', '192'], ['B trong năm', '36'], ['B đủ 12 tháng', '144']]) {
    await panel.getByLabel(label!).fill(value!);
  }
  await panel.getByRole('radio', { name: 'B', exact: true }).check();
  await panel.getByRole('textbox', { name: /^Viết đề xuất/ }).fill('Ưu tiên B. Kiểm chứng lịch ca và cỡ mẫu trước khi giải ngân.');
  await panel.getByRole('radio', { name: 'Cần luyện thêm' }).check();
  await save.click();
  await expect(panel.getByRole('heading', { name: 'Đề xuất đã lưu trên máy' })).toBeVisible();
  await page.reload();
  await expect(panel).toContainText('Chi phí và lựa chọn trong quỹ · Đạt');
  await expect(panel).toContainText('Cần luyện (tự đánh giá)');
  await expect(panel).toContainText('Ưu tiên B.');
});
