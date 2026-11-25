import { expect, test } from '@playwright/test';
import { audit, trackErrors } from './helpers/audit';

test('tạm dừng hội thoại, mở đúng lượt từ thư viện và giữ kết quả ngoại tuyến', async ({ page, context }) => {
  const errors = trackErrors(page);
  await page.goto('/#doc-them');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  const title = 'Đối chiếu tiền ăn ca trên phiếu lương';
  const libraryLink = page.getByRole('list', { name: 'Danh sách bài đọc' }).getByRole('link', { name: title });
  const practice = page.getByRole('region', { name: 'Từ bài đọc đến hội thoại' });
  const showModel = practice.getByRole('button', { name: 'Đã nói · Xem câu gợi ý' });
  const turn = practice.getByRole('heading', { level: 3 });
  await libraryLink.click();
  await showModel.click();
  await page.reload();
  await expect(turn).toHaveText('Lượt 1/3');
  await showModel.click();
  await practice.getByRole('button', { name: 'Cần luyện thêm' }).click();
  await expect(turn).toHaveText('Lượt 2/3');
  await expect(turn).toBeFocused();
  await expect(practice.getByRole('status')).toHaveText('Đã lưu 1/3 lượt tự chấm trên máy.');
  await practice.getByRole('link', { name: 'Tạm dừng · Về thư viện' }).click();
  const resumeCard = page.getByRole('region', { name: 'Hội thoại đang dở' });
  const resume = resumeCard.getByRole('link', { name: 'Tiếp tục lượt 2/3' });
  await expect(resumeCard).toContainText(title);
  await expect(resume).toBeFocused();
  await page.getByRole('button', { name: 'Quốc tế' }).click();
  await expect(libraryLink).toHaveCount(0);
  await expect(resume).toBeVisible();
  await page.getByRole('button', { name: 'Tất cả' }).click();
  await resume.click();
  await expect(turn).toBeFocused();
  await page.goBack();
  await expect(resume).toBeFocused();
  await resume.click();
  await page.reload();
  await expect(turn).toHaveText('Lượt 2/3');
  await expect(turn).toBeFocused();
  const findings: string[] = [];
  await audit(page, 'hội thoại đang luyện', findings);
  expect(findings).toEqual([]);
  for (const next of ['Lượt 3/3', 'Kết quả tự đánh giá']) {
    await showModel.click();
    await practice.getByRole('button', { name: 'Tôi đã làm được' }).click();
    await expect(turn).toHaveText(next);
  }
  await practice.getByRole('link', { name: 'Về thư viện bài đọc' }).click();
  await expect(libraryLink).toBeFocused();
  await expect(resumeCard).toHaveCount(0);
  await libraryLink.click();
  await expect(practice).toContainText('đạt 2/3 tiêu chí');
  await practice.getByRole('button', { name: 'Luyện lại ba lượt' }).click();
  await expect(turn).toHaveText('Lượt 1/3');
  await page.reload();
  await expect(turn).toHaveText('Lượt 1/3');
  expect(errors).toEqual([]);
});

test('giữ hai bài dở riêng và trở về đúng liên kết của bài trước', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/#doc-them');
  const titles = ['Đối chiếu tiền ăn ca trên phiếu lương', 'Tạm thay trưởng nhóm có được xét lại ngạch?'] as const;
  const practice = page.getByRole('region', { name: 'Từ bài đọc đến hội thoại' });
  const results = page.getByRole('list', { name: 'Danh sách bài đọc' });
  for (const title of titles) {
    await results.getByRole('link', { name: title }).click();
    await practice.getByRole('button', { name: 'Đã nói · Xem câu gợi ý' }).click();
    await practice.getByRole('button', { name: 'Tôi đã làm được' }).click();
    await practice.getByRole('link', { name: 'Tạm dừng · Về thư viện' }).click();
  }
  await page.reload();
  const card = page.getByRole('region', { name: 'Hội thoại đang dở' });
  await expect(card.getByRole('link', { name: 'Tiếp tục lượt 2/3' })).toHaveAttribute('href', /trao-doi-xet-lai-ngach/);
  await card.getByText('1 hội thoại đang dở khác').click();
  const other = card.getByRole('link', { name: titles[0] });
  await other.click();
  await expect(practice.getByRole('heading', { name: 'Lượt 2/3' })).toBeFocused();
  await page.goBack();
  await expect(other).toBeFocused();
  expect(errors).toEqual([]);
});
