import { expect, test, type Page } from '@playwright/test';

const noHScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

/** Ảnh cho mô tả PR: PW_SHOTS=goal npx playwright test goal-week --project="iPhone 14" */
const SHOTS = process.env.PW_SHOTS === 'goal';
test.use(SHOTS ? { deviceScaleFactor: 2 } : {});

/** Thêm thống kê các ngày trước (chỉ để ảnh chụp có biểu đồ đủ cột). */
const seedDays = (rows: Record<string, unknown>[]) =>
  new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('daily-study');
    open.onerror = () => reject(new Error('không mở được IndexedDB'));
    open.onsuccess = () => {
      const tx = open.result.transaction('days', 'readwrite');
      for (const r of rows) tx.objectStore('days').put(r);
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
      tx.onerror = () => reject(new Error('không ghi được'));
    };
  });

test('ôn vài câu → Hôm nay hiện tiến độ mục tiêu → Tiến độ hiện tổng kết tuần', async ({ page }, info) => {
  // Thứ Tư 18/11/2026, 20:00 giờ máy; đồng hồ giả để thời gian giữa các lượt chấm tính được.
  await page.clock.install({ time: new Date(2026, 10, 18, 20, 0, 0) });
  await page.goto('./#cai-dat');
  await page.getByTestId('goal-5').click();
  await expect(page.getByTestId('goal-5')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('rest-0').click();
  await expect(page.getByTestId('rest-0')).toHaveAttribute('aria-pressed', 'true');
  await noHScroll(page);
  if (SHOTS) await page.getByTestId('goal-5').scrollIntoViewIfNeeded();
  if (SHOTS) await page.clock.runFor(1500);
  if (SHOTS) await page.screenshot({ path: `docs/screenshots/goal-${info.project.name === 'iPhone SE' ? 'se-' : ''}cai-dat.png` });

  await page.goto('./#hom-nay');
  await expect(page.getByTestId('goal-min')).toHaveText('0');
  await expect(page.getByTestId('goal')).toHaveAttribute('data-done', 'false');
  await expect(page.getByTestId('goal-week')).toContainText('0/7 ngày đạt mục tiêu');
  await page.getByRole('button', { name: '5 phút', exact: true }).click();
  await page.getByRole('button', { name: 'Thẻ ghi nhớ' }).click();
  await page.getByRole('button', { name: 'Bắt đầu 5 phút' }).click();

  // 4 thẻ, mỗi thẻ 90 giây (dưới ngưỡng nghỉ 2 phút) = 6 phút.
  const count = page.getByTestId('sess-count');
  for (let i = 1; i <= 4; i++) {
    await expect(count).toHaveText(new RegExp(`^${i}/\\d+$`));
    await page.clock.fastForward(90_000);
    await page.getByRole('button', { name: 'Lật thẻ' }).click();
    await page.getByRole('button', { name: /Nhớ rõ/ }).click();
  }
  // Nghỉ 5 phút rồi mới chấm tiếp: khoảng này không được tính.
  await expect(count).toHaveText(/^5\/\d+$/);
  await page.clock.fastForward(300_000);
  await page.getByRole('button', { name: 'Lật thẻ' }).click();
  await page.getByRole('button', { name: /Nhớ rõ/ }).click();
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();

  await expect(page.getByTestId('goal-min')).toHaveText('6');
  await expect(page.getByTestId('goal')).toHaveAttribute('data-done', 'true');
  await expect(page.getByTestId('goal-done')).toBeVisible();
  await expect(page.getByTestId('goal-week')).toContainText('1/7 ngày đạt mục tiêu');
  await expect(page.getByRole('progressbar', { name: /Mục tiêu hôm nay: 6 trên 5 phút, đã đạt/ })).toBeVisible();
  await noHScroll(page);

  await page.goto('./#tien-do');
  await expect(page.getByTestId('week-range')).toContainText('Tuần này · 16/11 – 22/11');
  await expect(page.getByTestId('week-min')).toHaveText('6');
  await expect(page.getByTestId('week-goal-days')).toHaveText('1/7');
  await expect(page.getByTestId('week-reviews')).toHaveText('5');
  await expect(page.getByTestId('week-split')).toContainText('TR 6 phút');
  await expect(page.getByRole('img', { name: /Thứ Tư: 6 phút, đạt mục tiêu/ })).toBeVisible();
  await noHScroll(page);

  // Xem tuần trước (rỗng) rồi quay lại; không đi quá tuần hiện tại.
  const next = page.getByRole('button', { name: 'Xem tuần sau đó' });
  await expect(next).toBeDisabled();
  await page.getByRole('button', { name: 'Xem tuần trước đó' }).click();
  await expect(page.getByTestId('week-range')).toContainText('Tuần trước · 09/11 – 15/11');
  await expect(page.getByTestId('week-empty')).toBeVisible();
  await next.click();
  await expect(page.getByTestId('week-chart')).toBeVisible();

  // Giữ sau khi tải lại.
  await page.reload();
  await expect(page.getByTestId('week-min')).toHaveText('6');

  if (SHOTS) {
    const tag = info.project.name === 'iPhone SE' ? 'se-' : '';
    await page.goto('./#hom-nay');
    await expect(page.getByTestId('goal-done')).toBeVisible();
    await page.clock.runFor(1500); // đồng hồ giả: cho hiệu ứng chuyển trang chạy xong
    await page.screenshot({ path: `docs/screenshots/goal-${tag}hom-nay-dat.png` });
    await page.evaluate(seedDays, [
      { day: '2026-11-10', n: 18, ok: 11, s: 540 },
      { day: '2026-11-12', n: 22, ok: 15, s: 0, st: 200, se: 260, sk: 120, ks: 136, kn: 2, m: 1 },
      { day: '2026-11-16', n: 24, ok: 19, s: 0, st: 180, se: 260, sk: 110, ks: 156, kn: 2, m: 2 },
      { day: '2026-11-17', n: 9, ok: 6, s: 0, st: 60, se: 130, m: 1 },
    ]);
    await page.goto('./#tien-do');
    await page.reload();
    await expect(page.getByTestId('week-min')).toHaveText('18');
    await page.clock.runFor(1500);
    await page.evaluate(() => {
      document.querySelector('[data-testid="week"]')?.scrollIntoView();
      window.scrollBy(0, -120);
    });
    await page.screenshot({ path: `docs/screenshots/goal-${tag}tong-ket-tuan.png` });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: `docs/screenshots/goal-${tag}tong-ket-tuan-toi.png` });
  }
});
