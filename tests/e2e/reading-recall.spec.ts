import { expect, test } from '@playwright/test';
import { audit } from './helpers/audit';

test('gấp bài, tự nhớ khi ngoại tuyến, đối chiếu độ chắc và đổi dữ kiện', async ({ page, context }) => {
  await page.goto('/#lo-trinh?bai=trm-05-02');
  await page.getByRole('link', { name: 'Đọc thêm · Chọn mẫu số khi giải thích mức lương' }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Tiếng Việt' }).click();
  await page.getByRole('link', { name: 'Gấp bài và tự thử' }).click();
  const panel = page.getByRole('region', { name: 'Tự thử khi gấp bài' });
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(panel).toContainText('Một chuyên viên mua hàng');
  await expect(panel.getByRole('heading', { name: 'Một cách giải thích bằng tiếng Anh' })).toHaveCount(0);
  const go = panel.getByRole('button', { name: 'Đối chiếu đáp số' });
  await expect(go).toBeDisabled();
  await panel.getByRole('textbox').fill('93,75');
  await panel.getByRole('radio', { name: 'Khá chắc' }).check();
  await go.click();
  await expect(panel.getByRole('heading', { name: 'Đối chiếu phép tính' })).toBeFocused();
  await expect(panel).toContainText('37,5%');
  await expect(panel).toContainText('Bạn đã khá chắc');
  await panel.getByText('Nhắc ôn định kỳ bài này').click();
  await expect(panel.getByRole('button', { name: 'Tạo lời nhắc cho bài' })).toBeVisible();
  await panel.getByRole('link', { name: 'Thử tình huống khác' }).click();
  await expect(panel.getByRole('textbox')).toHaveValue('');
  await panel.getByRole('textbox').fill('95');
  await go.click();
  await expect(panel.getByRole('heading', { name: 'Bạn tính đúng' })).toBeVisible();
  await panel.getByRole('link', { name: 'Về bài đọc' }).click();
  await expect(page.getByRole('article').getByRole('heading', { level: 1 })).toHaveText('Chọn mẫu số khi giải thích mức lương');
  await page.getByRole('link', { name: 'Mở bài liên quan trong lộ trình Total Rewards' }).click();
  await expect(page).toHaveURL(/bai=trm-05-02$/);
});

test('tự tính thưởng và FTE trên bốn tình huống mới', async ({ page }) => {
  for (const [id, variant, answer] of [['on-lai-trong-so', 1, '24'], ['on-lai-trong-so', 2, '101'],
    ['doi-boi-canh-fte', 1, '35'], ['doi-boi-canh-fte', 2, '24']] as const) {
    await page.goto('/#doc-them?bai=' + id + '&tu-nho=' + variant);
    const panel = page.getByRole('region', { name: 'Tự thử khi gấp bài' });
    await panel.getByRole('textbox').fill(answer);
    await panel.getByRole('button', { name: 'Đối chiếu đáp số' }).click();
    await expect(panel.getByRole('heading', { name: 'Bạn tính đúng' })).toBeVisible();
    const findings: string[] = [];
    await audit(page, 'tu-nho', findings);
    expect(findings).toEqual([]);
  }
});
