import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { audit, freshHome, openTab } from './helpers/audit';
import { stubMedia, watchCsp } from './helpers/stubs';

/**
 * Sao lưu kèm ghi âm + nhắc sao lưu định kỳ (iPhone 14 / SE).
 * Đồng hồ trang đặt bằng page.clock.setFixedTime (bộ hẹn giờ vẫn chạy thật).
 */
test.use({ serviceWorkers: 'block' });

const DAY = 86_400_000;
const T0 = new Date('2026-11-01T09:00:00+07:00').getTime();
const SHOTS = process.env.PW_SHOTS === '1';
/** Chụp vào docs/screenshots/backup-<máy>-<màn>.png khi PW_SHOTS=1. */
async function shot(page: Page, where: string, sel?: string) {
  if (!SHOTS) return;
  const device = test.info().project.name.toLowerCase().replace(/\s+/g, '');
  await page.evaluate((s) => {
    const el = s ? document.querySelector(s) : null;
    if (el) el.scrollIntoView({ block: 'center' });
    else window.scrollTo(0, 0);
  }, sel ?? '');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `docs/screenshots/backup-${device}-${where}.png` });
}
const btn = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(watchCsp);
  await page.addInitScript(stubMedia);
});

/** Ôn một thẻ từ để có một ngày ôn. */
async function reviewOne(page: Page) {
  await freshHome(page);
  await page.getByRole('button', { name: /^Thẻ từ/ }).click();
  await btn(page, 'Lật thẻ').click();
  await btn(page, /^Nhớ rõ/).click();
  await btn(page, 'Kết thúc').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Ghi một bản ở "Đề nói 1 phút" (MediaRecorder giả: 2048 byte audio/mp4). */
async function recordOne(page: Page) {
  await freshHome(page);
  await page.getByRole('button', { name: /^Đề nói 1 phút/ }).click();
  await page.locator('.sh-tracks .opt').first().click();
  await btn(page, '30 giây').click();
  await btn(page, 'Bắt đầu ghi âm').click();
  await expect(page.getByTestId('rec-status')).toContainText('Đang ghi âm');
  await btn(page, 'Dừng & lưu').click();
  await expect(page.getByTestId('rec-item')).toHaveCount(1);
}

test('nhắc sao lưu: hiện sau 14 ngày, "Để sau" ẩn 3 ngày, "Sao lưu ngay" → xuất kèm ghi âm → hết nhắc', async ({ page }) => {
  test.slow();
  await page.clock.setFixedTime(T0);
  await page.goto('./#hom-nay');
  await reviewOne(page);
  await recordOne(page);
  await freshHome(page);
  await expect(page.getByTestId('backup-nudge')).toHaveCount(0);

  // 15 ngày sau, chưa sao lưu lần nào → hiện nhắc.
  await page.clock.setFixedTime(T0 + 15 * DAY);
  await page.reload();
  const nudge = page.getByTestId('backup-nudge');
  await expect(nudge).toContainText('chưa sao lưu tiến độ lần nào');
  const found: string[] = [];
  await audit(page, 'nhac-sao-luu', found);
  await shot(page, 'sang-nhac');
  await page.emulateMedia({ colorScheme: 'dark' });
  await audit(page, 'nhac-sao-luu-toi', found);
  await shot(page, 'toi-nhac');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(found).toEqual([]);

  // "Để sau" → ẩn, mở lại app vẫn ẩn; 3 ngày sau hiện lại.
  await btn(page, 'Để sau').click();
  await expect(nudge).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(nudge).toHaveCount(0);
  await page.clock.setFixedTime(T0 + 18 * DAY + 60_000);
  await page.reload();
  await expect(nudge).toBeVisible();

  // "Sao lưu ngay" → Cài đặt, nút xuất được focus; chọn kèm ghi âm rồi xuất.
  await page.getByRole('link', { name: 'Sao lưu ngay' }).click();
  await expect(page).toHaveURL(/#cai-dat$/);
  const exportBtn = btn(page, 'Xuất tiến độ (.json)');
  await expect(exportBtn).toBeFocused();
  await expect(page.getByTestId('backup-last')).toContainText('chưa có trên máy này');
  const chip = page.getByRole('button', { name: /^Kèm bản ghi âm \(≈ [\d,]+ KB\)$/ });
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await audit(page, 'cai-dat-kem-ghi-am', found);
  await page.emulateMedia({ colorScheme: 'dark' });
  await audit(page, 'cai-dat-kem-ghi-am-toi', found);
  await shot(page, 'toi-cai-dat', '[data-testid="with-rec"]');
  await page.emulateMedia({ colorScheme: 'light' });
  await shot(page, 'sang-cai-dat', '[data-testid="with-rec"]');
  expect(found).toEqual([]);

  const [download] = await Promise.all([page.waitForEvent('download'), exportBtn.click()]);
  const dump = JSON.parse(await readFile((await download.path())!, 'utf8')) as {
    app: string;
    recordings: { mime: string; size: number; ms: number; title: string; data: string }[];
    settings: { key: string }[];
  };
  expect(dump.app).toBe('daily-study');
  expect(dump.recordings).toHaveLength(1);
  expect(dump.recordings[0]).toMatchObject({ mime: 'audio/mp4', size: 2048 });
  expect(dump.recordings[0]!.title.length).toBeGreaterThan(0);
  expect(Buffer.from(dump.recordings[0]!.data, 'base64')).toEqual(Buffer.alloc(2048));
  expect(dump.settings.map((s) => s.key)).not.toContain('backup.lastAt');
  await expect(page.getByTestId('backup-status')).toContainText('1 bản ghi âm');
  await expect(page.getByTestId('backup-last')).toContainText('Lần sao lưu gần nhất: 19/11/2026');

  // Vừa sao lưu → hết nhắc.
  await openTab(page, 'hom-nay');
  await expect(nudge).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);

  // Nhập lại chính file đó (gộp) → không nhân đôi bản ghi.
  await openTab(page, 'cai-dat');
  await page.getByTestId('import-file').setInputFiles((await download.path())!);
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Bản ghi âm trong file: 1 (trên máy hiện có 1)');
  await dialog.getByRole('button', { name: 'Gộp' }).click();
  await expect(page.getByTestId('backup-status')).toContainText('Đã gộp');
  await expect(chip).toHaveText(/Kèm bản ghi âm/);
  await expect(page.getByText('1 bản ghi', { exact: true })).toBeVisible();
});
