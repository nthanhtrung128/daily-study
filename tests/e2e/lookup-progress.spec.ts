import { expect, test, type Page } from '@playwright/test';

const noHScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test('tra cứu không dấu → mở mục, chấm Quên, ghi chú → Tiến độ hiện số liệu và mục hay sai', async ({ page }) => {
  await page.goto('./#tra-cuu');
  const box = page.getByRole('searchbox');
  await box.fill('tong dai ngo');
  const item = page.locator('details.item', { has: page.locator('summary b', { hasText: /^Tổng đãi ngộ$/ }) });
  await item.locator('summary').click();
  await expect(item.getByText('Ý chính')).toBeVisible();
  await noHScroll(page);

  await item.getByRole('button', { name: /Quên/ }).click();
  await expect(item.getByText(/Đã chấm: Quên/)).toBeVisible();
  await item.getByLabel('Ghi chú').fill('Định nghĩa WorldatWork 2024');
  await item.getByRole('button', { name: 'Lưu ghi chú' }).click();
  await expect(item.getByText('Đã lưu ghi chú')).toBeVisible();

  // Lọc tiếng Anh và theo buổi.
  await box.fill('touch base');
  await page.getByRole('button', { name: 'Cụm từ EN' }).click();
  await expect(page.locator('summary b', { hasText: /^touch base$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await box.fill('');
  await page.getByRole('button', { name: 'Công thức' }).click();
  await page.getByRole('button', { name: 'Buổi 3', exact: true }).click();
  await expect(page.getByTestId('lk-count')).toHaveText(/^\d+ kết quả/);
  await noHScroll(page);

  await page.getByRole('link', { name: 'Tiến độ', exact: true }).click();
  await expect(page.getByTestId('pg-reviews')).toHaveText('1');
  await expect(page.getByTestId('pg-streak')).toHaveText('1');
  await expect(page.getByTestId('hard-list')).toContainText('Tổng đãi ngộ');
  await expect(page.locator('.heat i')).toHaveCount(35);
  await noHScroll(page);

  // Ghi chú còn sau khi tải lại.
  await page.goto('./#tra-cuu');
  await page.reload();
  await page.getByRole('searchbox').fill('tổng đãi ngộ');
  await item.locator('summary').click();
  await expect(item.getByLabel('Ghi chú')).toHaveValue('Định nghĩa WorldatWork 2024');
});

const LEGACY = {
  srs: { K001: [4, '2026-11-10', 0, '2026-10-27'], Q005: [1, '2026-11-01', 3, '2026-11-01'] },
  days: { '2026-10-31': { n: 20, ok: 15, s: 600 }, '2026-11-01': { n: 35, ok: 20, s: 1200 } },
  notes: { K001: 'Ghi chú từ Sổ ôn cũ' },
  prefs: { min: 15, mode: 'quiz', bai: [] },
  updatedAt: 1,
};

test('nhập state Sổ ôn bản cũ (có xác nhận), xuất lại file JSON', async ({ page }) => {
  await page.goto('./#cai-dat');
  await page.getByTestId('import-file').setInputFiles({
    name: 'tr101-state.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(LEGACY)),
  });
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('state Sổ ôn bản cũ');
  await expect(dialog).toContainText('55');
  await noHScroll(page);
  await dialog.getByRole('button', { name: 'Thay thế' }).click();
  await expect(page.getByTestId('backup-status')).toContainText('Đã thay tiến độ');

  await page.getByRole('link', { name: 'Tiến độ', exact: true }).click();
  await expect(page.getByTestId('pg-learned')).toHaveText('1');
  await expect(page.getByTestId('pg-reviews')).toHaveText('55');
  await expect(page.getByTestId('hard-list')).toBeVisible();

  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Xuất tiến độ (.json)' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^daily-study-tien-do-\d{8}-\d{4}\.json$/);
  const path = await download.path();
  const fs = await import('node:fs/promises');
  const dump = JSON.parse(await fs.readFile(path!, 'utf8')) as { app: string; items: { id: string }[]; notes: { text: string }[] };
  expect(dump.app).toBe('daily-study');
  expect(dump.items.map((i) => i.id).sort()).toEqual(['tr:K001', 'tr:Q005']);
  expect(dump.notes[0]?.text).toBe('Ghi chú từ Sổ ôn cũ');

  // Hủy không ghi gì.
  await page.getByTestId('import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(page.getByTestId('backup-status')).toContainText('Không nhận ra định dạng');
});
