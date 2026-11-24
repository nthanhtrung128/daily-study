import { expect, test } from '@playwright/test';
import { audit, trackErrors } from './helpers/audit';
import { stubMedia } from './helpers/stubs';

test('hai ngày luyện có memo và bản ghi riêng, nhìn lại đúng tuần ngay cả khi mất mạng', async ({ page, context }) => {
  const errors = trackErrors(page);
  await page.addInitScript(stubMedia);
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00'));
  await page.goto('/#hom-nay?tinh-huong=giai-thich-thuong');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);

  async function answer(memo: string, grade: string) {
    await page.getByText('Viết câu trả lời hoặc memo').click();
    await page.getByRole('textbox', { name: 'Memo của lượt này' }).fill(memo);
    await expect(page.getByText('Đã lưu trên máy.')).toBeVisible();
    await page.getByRole('button', { name: 'Mở ghi âm (tùy chọn)' }).click();
    await page.getByRole('button', { name: 'Bắt đầu ghi âm' }).click();
    await page.getByRole('button', { name: 'Dừng & lưu' }).click();
    await expect(page.getByTestId('rec-status')).toContainText('Đã lưu');
    await page.getByRole('button', { name: grade }).click();
    await page.getByRole('link', { name: 'Nhìn lại tuần' }).click();
  }
  await answer('Gọi tên hai thành phần.', 'Tôi cần gợi ý');
  await expect(page.getByText('Luyện thêm một lượt', { exact: false })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Lần trước' })).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-11-26T11:00:00'));
  await page.getByRole('link', { name: 'Luyện một câu · 2 phút' }).click();
  await answer('Your result contributes 33 points.', 'Tôi đã tự trả lời');
  const before = page.getByRole('article', { name: 'Lần trước' });
  const now = page.getByRole('article', { name: 'Lần gần nhất' });
  await expect(before.locator('time')).toHaveAttribute('datetime', '2026-11-24');
  await expect(now.locator('time')).toHaveAttribute('datetime', '2026-11-26');
  await expect(before).toContainText('Gọi tên hai thành phần.');
  await expect(now).toContainText('Your result contributes 33 points.');
  await expect(before).toContainText('Cần gợi ý');
  await expect(now).toContainText('Đã tự trả lời');
  for (const entry of [before, now]) {
    await entry.getByText('Nghe lại bản ghi').click();
    await expect(entry.locator('audio[controls]')).toHaveAttribute('src', /^blob:/);
  }
  expect(await before.locator('audio').getAttribute('src')).not.toEqual(await now.locator('audio').getAttribute('src'));
  const reflection = page.getByRole('textbox', { name: 'Memo cuối tuần' });
  await reflection.fill('Tôi đã giải thích cho quản lý. Tuần sau muốn thử phản biện.');
  await expect(page.getByText('Đã lưu trên máy.')).toBeVisible();
  await page.reload();
  await expect(reflection).toHaveValue(/muốn thử phản biện/);
  const findings: string[] = [];
  await audit(page, 'hai lượt nói trong tuần', findings);
  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test('memo cuối tuần tách theo tuần và đề, Tiến độ mở lại đúng tình huống đang luyện', async ({ page }) => {
  const errors = trackErrors(page);
  await page.clock.setFixedTime(new Date('2026-11-26T11:00:00'));
  await page.goto('/#hom-nay?tinh-huong=giai-thich-thuong');
  await page.getByRole('button', { name: 'Tôi đã tự trả lời' }).click();
  await page.getByRole('link', { name: 'Nhìn lại tuần' }).click();
  const reflection = page.getByRole('textbox', { name: 'Memo cuối tuần' });
  await reflection.fill('Tuần sau muốn thử phản biện.');
  await expect(page.getByText('Đã lưu trên máy.')).toBeVisible();
  await page.getByRole('link', { name: 'Tuần trước' }).click();
  await expect(page.getByText('Tuần này chưa có lượt nào cho tình huống này.')).toBeVisible();
  await expect(reflection).toHaveValue('');
  await page.getByRole('link', { name: 'Tuần sau' }).click();
  await expect(reflection).toHaveValue(/muốn thử phản biện/);
  await page.getByText('Đổi tình huống xem lại').click();
  await page.getByRole('link', { name: 'Bắt chuyện trước cuộc họp ca' }).click();
  await expect(reflection).toHaveValue('');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('link', { name: 'Tiến độ', exact: true }).click();
  await page.getByRole('link', { name: 'Nhìn lại tình huống công việc' }).click();
  await expect(page.getByRole('article', { name: 'Lần gần nhất' })).toContainText('I beat my target.');
  await expect(reflection).toHaveValue(/muốn thử phản biện/);
  await expect(page.getByRole('button', { name: 'Tuần sau' })).toBeDisabled();
  const findings: string[] = [];
  await audit(page, 'nhìn lại tuần', findings);
  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});
