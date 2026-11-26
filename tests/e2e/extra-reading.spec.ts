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
  await expect(list.getByRole('link')).toHaveCount(17);
  await page.getByRole('button', { name: 'Quốc tế' }).click();
  await expect(list.getByRole('link')).toHaveCount(12);
  await page.getByRole('button', { name: 'Việt Nam' }).click();
  await expect(list.getByRole('link')).toHaveCount(5);
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

const newSituations = [
  {
    id: 'doi-chieu-tien-an-ca', title: 'Đối chiếu tiền ăn ca trên phiếu lương', query: 'tien an ca', region: 'Việt Nam',
    source: 'Quốc hội Việt Nam', answer: '80.000 đồng', followUp: 'một ca trị giá 40.000 đồng',
  },
  {
    id: 'trao-doi-xet-lai-ngach', title: 'Tạm thay trưởng nhóm có được xét lại ngạch?', query: 'xet lai ngach', region: 'Quốc tế',
    source: 'CIPD', answer: 'trách nhiệm quyết định', followUp: 'quyền duyệt lâu dài ở hai cơ sở',
  },
  {
    id: 'kiem-chung-nghi-viec', title: 'Bốn lượt nghỉ việc cho biết điều gì?', query: 'bon luot nghi viec', region: 'Quốc tế',
    source: 'U.S. Bureau of Labor Statistics', answer: 'Hai cuộc phỏng vấn', followUp: 'tỷ lệ tự xin nghỉ trong quý là 6%',
  },
];

for (const item of newSituations) {
  test('từ đọc song ngữ đến lượt vận dụng tuần sau · ' + item.title, async ({ page }) => {
    const errors = trackErrors(page);
    await page.clock.setFixedTime(new Date('2026-11-24T12:00:00'));
    await page.goto('/#doc-them');
    await page.getByRole('searchbox').fill(item.query);
    await page.getByRole('button', { name: item.region }).click();
    await page.getByRole('link', { name: item.title }).click();
    const article = page.getByRole('article');
    await article.getByRole('button', { name: 'Tiếng Việt' }).click();
    await expect(article.getByRole('heading', { level: 1 })).toHaveText(item.title);
    await expect(article.getByRole('link', { name: item.source })).toHaveAttribute('href', /^https:\/\//);
    await article.getByRole('link', { name: 'Chọn luyện trong tuần · 2 phút' }).click();
    await expect(page).toHaveURL(new RegExp(item.id + '$'));
    await page.getByRole('button', { name: 'Tôi đã tự trả lời' }).click();
    const home = page.getByRole('link', { name: 'Xong · Về Hôm nay' });
    const start = page.getByRole('link', { name: 'Luyện một câu · 2 phút' });
    await home.click();
    await start.click();
    await page.getByRole('button', { name: 'Tôi cần gợi ý' }).click();
    await expect(page.getByText(item.answer, { exact: false }).first()).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-12-01T12:00:00'));
    await home.click();
    await start.click();
    await expect(page.getByText('Vận dụng với dữ kiện mới', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Tôi đã tự trả lời' }).click();
    await expect(page.getByText(item.followUp, { exact: false }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
