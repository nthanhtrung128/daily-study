import { expect, test } from '@playwright/test';
test('bản đồ bốn chặng đưa tới đúng danh sách và bài vận dụng', async ({ page }) => {
  await page.goto('/#lo-trinh');
  const map = page.getByRole('region', { name: 'Bản đồ bốn chặng' });
  await expect(map.getByRole('button')).toHaveCount(4);
  await expect(map.getByRole('button').first()).toContainText('Học tiếp tại đây');
  await map.getByRole('button').nth(1).click();
  await expect(page.getByRole('heading', { name: 'Thiết kế lương và thưởng', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Vận dụng cuối chặng · Lập phiếu điều tra công bằng lương' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ công bằng lương');
});
