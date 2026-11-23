import { expect, test } from '@playwright/test';
import { audit, openTab, trackErrors } from './helpers/audit';

test('lọc nguồn, đối chiếu hai ngôn ngữ và tự kiểm tra khi ngoại tuyến', async ({ page, context }) => {
  const errors = trackErrors(page);
  await page.goto('./#doc-them');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  const list = page.getByRole('list', { name: 'Danh sách bài đọc' });
  await expect(list.getByRole('link')).toHaveCount(9);
  await page.getByRole('button', { name: 'Quốc tế' }).click();
  await expect(list.getByRole('link')).toHaveCount(5);
  await page.getByRole('button', { name: 'Việt Nam' }).click();
  await expect(list.getByRole('link')).toHaveCount(4);
  const item = list.getByRole('link', { name: 'Which engineers belong in the comparison?' });
  await item.click();
  await page.reload();
  const article = page.getByRole('article');
  await expect(article.getByRole('heading', { level: 1 })).toHaveAttribute('lang', 'en');
  await article.getByText('Dịch đoạn 2', { exact: true }).click();
  await expect(article.getByText(/^Cô minh họa trung vị/)).toBeVisible();
  await expect(article.getByText(/^She illustrates a median/)).toBeVisible();
  await article.getByRole('button', { name: 'Tiếng Việt' }).click();
  await expect(article.getByRole('heading', { level: 1 })).toHaveText('Nên so sánh nhóm kỹ sư nào?');
  await expect(article.getByText(/^Cô minh họa trung vị/)).toBeVisible();
  await article.getByText('Xem tiếng Anh đoạn 2', { exact: true }).click();
  await expect(article.getByText(/^She illustrates a median/)).toBeVisible();
  await article.getByText('Xem đáp án', { exact: true }).click();
  await expect(article.getByText(/^Số trung bình tăng/)).toBeVisible();
  await expect(article.getByRole('link', { name: /^ITviec/ })).toHaveAttribute('href', /^https:\/\/itviec.com\//);
  const findings: string[] = [];
  await audit(page, 'bai-doc-song-ngu', findings);
  expect(findings).toEqual([]);
  await article.getByRole('link', { name: 'Về Đọc thêm' }).click();
  await expect(item).toBeFocused();
  await item.click();
  await page.goBack();
  await expect(item).toBeFocused();
  await openTab(page, 'lo-trinh');
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  expect(errors).toEqual([]);
});

test('từ email đến ba lượt trao đổi và xem tiêu chí cần luyện', async ({ page }) => {
  await page.goto('/#doc-them?bai=thu-du-toan');
  const practice = page.getByRole('region', { name: 'Từ bài đọc đến hội thoại' });
  for (let i = 0; i < 3; i++) {
    await expect(practice.getByRole('heading', { name: 'Lượt ' + (i + 1) + '/3' })).toBeVisible();
    await practice.getByRole('button', { name: 'Đã nói · Xem câu gợi ý' }).click();
    await practice.getByRole('button', { name: i === 1 ? 'Cần luyện thêm' : 'Tôi đã làm được' }).click();
  }
  await expect(practice).toContainText('đạt 2/3');
  await expect(practice.getByRole('listitem').nth(1)).toContainText('Cần luyện thêm');
  await practice.getByRole('button', { name: 'Luyện lại ba lượt' }).click();
  await expect(practice.getByRole('heading', { name: 'Lượt 1/3' })).toBeVisible();
});
