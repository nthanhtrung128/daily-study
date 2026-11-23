import { expect, test } from '@playwright/test';

const PAGES = [
  { hash: 'hom-nay', tab: 'Hôm nay', heading: 'Trung tâm học tập' },
  { hash: 'tra-cuu', tab: 'Tra cứu', heading: 'Tra cứu' },
  { hash: 'lo-trinh', tab: 'Lộ trình', heading: 'Đọc và tự ôn Total Rewards' },
  { hash: 'doc-them', tab: 'Đọc thêm', heading: 'Đọc thêm' },
  { hash: 'tien-do', tab: 'Tiến độ', heading: 'Tiến độ' },
  { hash: 'cai-dat', tab: 'Cài đặt', heading: 'Cài đặt' },
];

test('điều hướng qua 6 trang bằng tab, không cuộn ngang', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trung tâm học tập');

  for (const p of PAGES) {
    await page.getByRole('link', { name: p.tab, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${p.hash}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.heading);
    await expect(page.getByRole('link', { name: p.tab, exact: true })).toHaveAttribute('aria-current', 'page');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test('mở thẳng bằng hash và quay lại bằng nút Back', async ({ page }) => {
  await page.goto('./#tien-do');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tiến độ');
  await page.getByRole('link', { name: 'Tra cứu', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tiến độ');
});

test('chuyển giao diện tối và giữ sau khi tải lại', async ({ page }) => {
  await page.goto('./#cai-dat');
  await page.getByRole('button', { name: 'Tối' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Tối' })).toHaveAttribute('aria-pressed', 'true');
});

test('có manifest PWA tiếng Việt', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(href!);
  const manifest = (await res.json()) as { lang: string; short_name: string; icons: unknown[] };
  expect(manifest.lang).toBe('vi');
  expect(manifest.short_name).toBe('Ôn mỗi ngày');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
});

test('chạy offline sau lần mở đầu (service worker)', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Chờ SW kiểm soát trang để precache đã sẵn sàng.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('./#tra-cuu');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tra cứu');
  await context.setOffline(false);
});
