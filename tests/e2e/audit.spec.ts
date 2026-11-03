import { expect, test, type Page } from '@playwright/test';
import { audit, trackErrors, walkApp } from './helpers/audit';
import { stubMedia, watchCsp } from './helpers/stubs';

/**
 * S9b: rà toàn app như người dùng iPhone. Đi hết các luồng (phiên trộn, TR riêng, EN: thẻ từ, câu mẫu, shadowing,
 * luyện nói, đề nói; Tra cứu, Tiến độ, Cài đặt) ở cả giao diện sáng và tối, mỗi màn kiểm:
 * không tràn ngang, chữ không tràn hộp, vùng chạm ≥ 44 px, tương phản chữ đủ, không lỗi console / CSP.
 */

/** Mở trang Hôm nay từ đầu (đổi hash sang cùng trang không làm trang mở lại). */
const gotoHome = async (page: Page) => {
  await page.goto('./#tien-do');
  await page.goto('./#hom-nay');
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(watchCsp);
  await page.addInitScript(stubMedia);
});

const VARIANTS = [
  { scheme: 'light', width: 0 },
  { scheme: 'dark', width: 0 },
  { scheme: 'light', width: 375 },
  { scheme: 'dark', width: 375 },
] as const;

for (const { scheme, width } of VARIANTS) {
  test(`quét mọi màn: ${scheme === 'light' ? 'sáng' : 'tối'}${width ? `, rộng ${width}px` : ''}`, async ({ page }, info) => {
    test.slow();
    // Project "iPhone SE" của Playwright rộng 320 px, "iPhone 14" 390 px; thêm 375 px (iPhone SE 2/3, 13 mini) một lần.
    test.skip(!!width && !info.project.name.startsWith('iPhone 14'), '375px chỉ cần chạy một lần');
    if (width) await page.setViewportSize({ width, height: 640 });
    await page.emulateMedia({ colorScheme: scheme });
    const errors = trackErrors(page);
    const found: string[] = [];
    await walkApp(page, (where) => audit(page, where, found));
    expect(found, found.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });
}

test('giao diện Tối chọn tay (máy đang sáng): đủ tương phản, theme-color đổi theo', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const found: string[] = [];
  await page.goto('./#cai-dat');
  await page.getByRole('button', { name: 'Tối', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const colors = await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')));
  expect(new Set(colors)).toEqual(new Set(['#0E1318']));
  for (const hash of ['hom-nay', 'tra-cuu', 'tien-do', 'cai-dat']) {
    await page.goto(`./#${hash}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, `tối-tay #${hash}`, found);
  }
  await page.getByRole('button', { name: 'Theo máy', exact: true }).click();
  const back = await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')));
  expect(back).toEqual(['#EEF1F4', '#0E1318']);
  expect(found, found.join('\n')).toEqual([]);
});

test('khả năng tiếp cận: focus khi lật/chuyển thẻ, aria-live cho đúng/sai, nút icon có nhãn', async ({ page }) => {
  await gotoHome(page);
  await page.getByRole('button', { name: '5 phút', exact: true }).click();
  await page.getByRole('button', { name: 'Thẻ ghi nhớ' }).click();
  await page.getByRole('button', { name: 'Bắt đầu 5 phút' }).click();
  await page.getByRole('button', { name: 'Lật thẻ' }).click();
  // Nút "Lật thẻ" biến mất → focus vào mặt sau, không rơi về <body>.
  expect(await page.evaluate(() => document.activeElement?.closest('.card') !== null)).toBe(true);
  await page.getByRole('button', { name: /^Nhớ rõ/ }).click();
  await expect(page.getByTestId('sess-count')).toHaveText(/^2\//);
  // Thẻ mới: focus ở đầu thẻ để trình đọc màn hình đọc từ đầu.
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.card') !== null)).toBe(true);

  // Trắc nghiệm: phản hồi đúng/sai nằm trong vùng aria-live.
  await gotoHome(page);
  await page.getByRole('button', { name: 'Trắc nghiệm' }).click();
  await page.getByRole('button', { name: /^Bắt đầu 5 phút/ }).click();
  await page.locator('.opt').first().click();
  await expect(page.locator('[aria-live="polite"] .fb')).toBeVisible();

  // Mọi nút đều có tên đọc được (kể cả nút chỉ có icon trong trình phát shadowing).
  await gotoHome(page);
  await page.getByRole('button', { name: /^Shadowing/ }).click();
  await page.getByRole('button', { name: /Họp · phần 1/ }).click();
  for (const name of ['Câu trước', 'Phát', 'Câu sau']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[href]')].filter((b) => !(b.getAttribute('aria-label') || b.textContent || '').trim()).length,
  );
  expect(unnamed).toBe(0);

  // Đề nói: đếm ngược báo qua vùng aria-live riêng (không đọc mỗi giây).
  await gotoHome(page);
  await page.getByRole('button', { name: /^Đề nói 1 phút/ }).click();
  await page.locator('.sh-tracks .opt').first().click();
  await page.getByRole('button', { name: '30 giây' }).click();
  await page.getByRole('button', { name: 'Bắt đầu ghi âm' }).click();
  await expect(page.getByTestId('rec-announce')).toHaveText(/Bắt đầu ghi âm, 30 giây/);
  await page.getByRole('button', { name: 'Dừng & lưu' }).click();
});

test('rời màn khi đang đọc / nghe / ghi âm: tắt TTS, nhận giọng và micro', async ({ page }) => {
  type W = { __recLive: number; __tracksStopped: number; __synthCancels: number; __nextSay: string };
  const w = <K extends keyof W>(k: K) => page.evaluate((key) => (window as unknown as W)[key], k);

  // Đang ghi âm đề nói → chuyển tab Tra cứu: micro được giải phóng, bản ghi dở vẫn được lưu.
  await gotoHome(page);
  await page.getByRole('button', { name: /^Đề nói 1 phút/ }).click();
  await page.locator('.sh-tracks .opt').first().click();
  await page.getByRole('button', { name: 'Bắt đầu ghi âm' }).click();
  await expect(page.getByTestId('rec-status')).toContainText('Đang ghi âm');
  await page.getByRole('link', { name: 'Tra cứu' }).click();
  await expect.poll(() => w('__tracksStopped')).toBe(1);
  await page.getByRole('link', { name: 'Hôm nay' }).click();
  await page.getByRole('button', { name: /^Đề nói 1 phút/ }).click();
  await expect(page.getByTestId('rec-item')).toHaveCount(1);

  // Đang nhận giọng trong thẻ câu mẫu → ẩn app: dừng nhận giọng.
  await gotoHome(page);
  await page.getByRole('button', { name: /^Câu mẫu/ }).click();
  await page.evaluate(() => ((window as unknown as W).__nextSay = 'HOLD'));
  await page.getByRole('button', { name: 'Nói thử' }).click();
  await expect.poll(() => w('__recLive')).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => w('__recLive')).toBe(0);

  // Trang Cài đặt: Nghe thử rồi chuyển tab → hủy đọc.
  await page.goto('./#cai-dat');
  const before = await w('__synthCancels');
  await page.getByRole('button', { name: 'Nghe thử' }).click();
  await page.getByRole('link', { name: 'Tiến độ' }).click();
  await expect.poll(() => w('__synthCancels')).toBeGreaterThan(before);
});

test('offline sau lần mở đầu: mọi trang, mọi màn tiếng Anh và tra cứu vẫn chạy, không lỗi', async ({ page, context }) => {
  test.slow();
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const errors = trackErrors(page);
  await context.setOffline(true);
  await page.reload();
  // Đi lại toàn bộ luồng khi mất mạng (nội dung JSON, các chunk tải sau đều phải có trong cache).
  await walkApp(page, async () => undefined);
  expect(errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED/.test(e)), errors.join('\n')).toEqual([]);
  await context.setOffline(false);
});
