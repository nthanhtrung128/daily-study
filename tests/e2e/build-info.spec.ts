import { expect, test } from '@playwright/test';

test('đọc đúng mã bản đã tải và cách mở sau khi mất mạng', async ({ page, context }) => {
  await page.goto('/#cai-dat');
  const data = page.getByRole('region', { name: 'Dữ liệu' });
  const version = data.getByText(/^Phiên bản /);
  const commit = [process.env.CF_PAGES_COMMIT_SHA, process.env.GITHUB_SHA]
    .find(value => value && /^[0-9a-f]{40}$/i.test(value));
  if (commit) await expect(version.locator('code')).toHaveText(commit.slice(0, 7).toLowerCase());
  else await expect(version).toContainText('Chưa có mã bản dựng');
  await expect(version).toContainText('Mở trong trình duyệt');
  const label = await version.innerText();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(version).toHaveText(label, { useInnerText: true });
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await page.reload();
  await expect(version).toContainText('Mở từ Màn hình chính');
});
