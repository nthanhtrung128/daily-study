import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { audit, openTab, trackErrors } from './helpers/audit';

test('ghi memo, tìm không dấu, mở đúng bài và sửa khi ngoại tuyến', async ({ page, context }) => {
  const errors = trackErrors(page);
  await page.goto('./#lo-trinh');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.getByRole('link', { name: 'Sổ memo bài học' }).click();
  await expect(page.getByText(/Chưa có memo/)).toBeVisible();
  await page.getByRole('link', { name: 'Về lộ trình' }).click();
  await page.getByRole('link', { name: /^Bắt đầu M01/ }).click();
  const input = page.getByRole('textbox', { name: 'Memo của bài' });
  await page.getByRole('button', { name: 'Ghi memo' }).click();
  await expect(input).toBeFocused();
  await input.fill('Đối chiếu tỷ lệ nghỉ việc\nTheo nhóm kỹ sư');
  await expect(page.getByText('Đã lưu trên máy.')).toBeVisible();
  await page.reload();
  await expect(input).toHaveValue('Đối chiếu tỷ lệ nghỉ việc\nTheo nhóm kỹ sư');
  await page.getByRole('link', { name: 'Đọc bài kế tiếp' }).click();
  await expect(input).toHaveValue('');
  await input.fill('Xem lại danh mục quyền lợi');
  await expect(page.getByText('Đã lưu trên máy.')).toBeVisible();
  await openTab(page, 'lo-trinh');
  await page.getByRole('link', { name: 'Sổ memo bài học (2)' }).click();
  await expect(page.locator('.memo-list li').first()).toContainText('Xem lại danh mục quyền lợi');
  const search = page.getByRole('searchbox');
  await search.fill('ky su');
  const result = page.getByRole('link', { name: 'Thiết kế từ vấn đề kinh doanh' });
  await expect(page.locator('.memo-list li')).toHaveCount(1);
  await result.click();
  await expect(page.getByRole('heading', { name: 'Memo của bài' })).toBeFocused();
  await expect(input).toHaveValue(/kỹ sư/);
  await input.fill('Kiểm lại tỷ lệ theo quý');
  await expect(page.getByText('Đã lưu trên máy.')).toBeVisible();
  await page.getByRole('link', { name: 'Về sổ memo' }).click();
  await expect(search).toHaveValue('ky su');
  await expect(page.getByText('Không tìm thấy memo phù hợp.')).toBeVisible();
  await search.fill('m01 theo quy');
  await expect(result).toBeVisible();
  const findings: string[] = [];
  await audit(page, 'so-memo', findings);
  expect(findings).toEqual([]);
  await result.click();
  await input.fill('');
  await expect(page.getByText('Đã xóa memo.')).toBeVisible();
  await openTab(page, 'lo-trinh');
  await expect(page.getByRole('link', { name: 'Sổ memo bài học (1)' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  expect(errors).toEqual([]);
});

test('sao lưu và khôi phục memo bài học cùng ghi chú thẻ', async ({ page }) => {
  await page.goto('./#lo-trinh?bai=trm-17-04');
  await page.getByRole('textbox', { name: 'Memo của bài' }).fill('So sánh option và RSU');
  await expect(page.getByText('Đã lưu trên máy.')).toBeVisible();
  await openTab(page, 'cai-dat');
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất tiến độ (.json)' }).click(),
  ]);
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.notes).toEqual([{ id: 'trm-17-04', text: 'So sánh option và RSU', at: expect.any(Number) }]);
  backup.notes[0].text = 'Đọc lại điều kiện vesting';
  backup.notes.push({ id: 'tr:K001', text: 'Ghi chú thẻ riêng', at: Date.now() });
  backup.notes.push({ id: 'trm-09-03:tu-nho:2:2026-11-10', text: 'Giải thích được FTE.', at: Date.now() });
  await page.getByTestId('import-file').setInputFiles({
    name: 'memo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Thay thế' }).click();
  await expect(page.getByTestId('backup-status')).toContainText('Đã thay tiến độ');
  await openTab(page, 'lo-trinh');
  await page.getByRole('link', { name: 'Sổ memo bài học (2)' }).click();
  await expect(page.locator('.memo-list li')).toHaveCount(2);
  await expect(page.locator('.memo-list')).toContainText('Đọc lại điều kiện vesting');
  await page.getByRole('link', { name: /Tình huống 2 · 10\/11\/2026/ }).click();
  await expect(page.getByRole('textbox')).toHaveValue('Giải thích được FTE.');
  await page.getByRole('link', { name: 'Làm lại tình huống này' }).click();
  await expect(page).toHaveURL(/bai=doi-boi-canh-fte&tu-nho=2$/);
});
