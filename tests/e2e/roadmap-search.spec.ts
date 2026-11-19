import { expect, test } from '@playwright/test';
import { audit, trackErrors } from './helpers/audit';

test('tìm bài ngoại tuyến theo nội dung, tên hoặc mã rồi quay về đúng kết quả', async ({ page, context }) => {
  const errors = trackErrors(page);
  await page.goto('./#lo-trinh');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);

  const input = page.getByRole('searchbox', { name: 'Tìm bài trong lộ trình' });
  const results = page.getByRole('list', { name: 'Kết quả tìm bài' });
  await input.fill('trung diem so hoc');
  await expect(results.getByText('M05.1', { exact: false })).toBeVisible();
  await input.fill('ma tran merit');
  const merit = results.getByRole('link').first();
  await expect(merit).toHaveText('Thiết kế ma trận merit');
  await merit.click();
  await expect(page.getByRole('heading', { name: 'Thiết kế ma trận merit' })).toBeVisible();
  await page.goBack();
  await expect(input).toHaveValue('ma tran merit');
  await expect(merit).toBeFocused();

  await input.fill('M05.2');
  await expect(results.getByRole('link')).toHaveCount(1);
  await results.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Diễn giải compa và penetration' })).toBeVisible();
  await page.getByRole('button', { name: 'Về kho kiến thức' }).click();
  await expect(results.getByRole('link')).toBeFocused();
  const findings: string[] = [];
  await audit(page, 'tim-bai', findings);
  expect(findings).toEqual([]);

  await input.fill('xyzzyqqq');
  await expect(page.getByText('Không tìm thấy bài phù hợp.')).toBeVisible();
  await expect(results).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa tìm kiếm' }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Đãi ngộ chuyên sâu' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  expect(errors).toEqual([]);
});
