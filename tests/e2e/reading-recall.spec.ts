import { expect, test } from '@playwright/test';
import { audit, trackErrors } from './helpers/audit';

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

test('memo tự thử theo ngày và đề, mở lại và sửa từ sổ khi ngoại tuyến', async ({ page, context }) => {
  const errors = trackErrors(page);
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00'));
  await page.goto('/#lo-trinh?bai=trm-05-02');
  const saved = page.getByText('Đã lưu trên máy.');
  await page.getByRole('textbox', { name: 'Memo của bài' }).fill('Memo bài chính.');
  await expect(saved).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);

  await page.getByRole('link', { name: /Đọc thêm · Chọn mẫu số/ }).click();
  await page.getByRole('link', { name: 'Gấp bài và tự thử' }).click();
  const memo = page.getByText('Ghi memo lần tự thử', { exact: true });
  async function answer(value: string) {
    await expect(memo).toHaveCount(0);
    await page.getByRole('textbox', { name: /Đáp số/ }).fill(value);
    await page.getByRole('button', { name: 'Đối chiếu đáp số' }).click();
    await memo.click();
  }
  await answer('93,75');
  const first = 'Tôi còn nhầm mẫu số.';
  const second = 'Tôi giải thích được trung điểm.';
  const nextDay = 'Tôi đã tự tính được.';
  await page.getByRole('textbox', { name: 'Tình huống 1 · 10/11/2026' }).fill(first);
  await expect(saved).toBeVisible();
  await page.getByRole('link', { name: 'Thử tình huống khác' }).click();
  await answer('95');
  await page.getByRole('textbox', { name: 'Tình huống 2 · 10/11/2026' }).fill(second);
  await expect(saved).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-12T12:00:00'));
  await page.getByRole('link', { name: 'Thử tình huống khác' }).click();
  await answer('37,5');
  const current = page.getByRole('textbox', { name: 'Tình huống 1 · 12/11/2026' });
  await expect(current).toHaveValue('');
  await current.fill(nextDay);
  await expect(saved).toBeVisible();
  await page.getByRole('link', { name: 'Mở sổ memo' }).click();
  await page.reload();
  const entries = page.locator('.memo-list li');
  await expect(entries).toHaveCount(4);
  await expect(entries.filter({ hasText: 'Memo bài chính.' })).toHaveCount(1);
  await page.getByRole('searchbox').fill('m05 nham mau so');
  await expect(entries).toHaveCount(1);
  await entries.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Memo lần tự thử' })).toBeFocused();
  const old = page.getByRole('textbox', { name: 'Tình huống 1 · 10/11/2026' });
  await expect(old).toHaveValue(first);
  await old.fill('Đã tìm được mẫu số đúng.');
  await expect(saved).toBeVisible();
  await page.getByRole('link', { name: 'Làm lại tình huống này' }).click();
  await expect(page).toHaveURL(/bai=nho-moc-so-sanh&tu-nho=1$/);
  await answer('37,5');
  await expect(current).toHaveValue(nextDay);
  await page.getByRole('link', { name: 'Mở sổ memo' }).click();
  await expect(entries).toHaveCount(4);
  await expect(entries.filter({ hasText: 'Đã tìm được mẫu số đúng.' })).toHaveCount(1);
  expect(errors).toEqual([]);
});
