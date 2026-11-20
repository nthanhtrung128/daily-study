import { expect, test } from '@playwright/test';
import { audit, openReadingModule, openTab } from './helpers/audit';
import { watchCsp } from './helpers/stubs';

test('học M05 từ Hôm nay, thử tính, lưu tiến độ và học tiếp', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Mở lộ trình Total Rewards' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đọc và tự ôn Total Rewards');
  const module = await openReadingModule(page, 'Cấu trúc lương cơ bản');
  await module.getByRole('button', { name: /^Bắt đầu học/ }).click();
  await page.getByRole('button', { name: 'Hoàn thành và học tiếp' }).click();
  await page.getByRole('button', { name: 'Về kho kiến thức' }).click();
  await expect(page.getByText('1/4 bài đã hoàn thành')).toBeVisible();
  await page.getByRole('button', { name: /^Học tiếp/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Diễn giải compa và penetration');
  const prediction = page.getByLabel('Dự đoán compa-ratio (%)');
  const compare = page.getByRole('button', { name: 'Đối chiếu dự đoán' });
  const calculate = page.getByRole('button', { name: 'Tính vị trí trong dải' });
  await expect(calculate).toHaveCount(0);
  await compare.click();
  await expect(page.getByRole('alert')).toHaveText('Nhập một tỷ lệ phần trăm hợp lệ.');
  await prediction.fill('95,5 %');
  await compare.click();
  await expect(page.getByText('19,2 ÷ 20 = 96%.')).toBeVisible();
  await expect(page.getByText('Dự đoán thấp hơn 0,5 điểm phần trăm.')).toBeVisible();
  await prediction.fill('96');
  await expect(calculate).toHaveCount(0);
  await compare.click();
  await expect(page.getByText('Dự đoán khớp với kết quả.')).toBeVisible();
  await calculate.click();
  await expect(page.getByRole('status').filter({ hasText: /Nhập min dương/ })).toBeVisible();
  await page.getByLabel('Min (triệu đồng/tháng)').fill('16,0');
  await page.getByLabel('Max (triệu đồng/tháng)').fill('24');
  await calculate.click();
  await expect(page.getByText('Vị trí trong dải: 40,0%.')).toBeVisible();
  if (process.env.PW_SHOTS === 'roadmap') {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath('m05.png'), fullPage: true });
  }
  await page.getByRole('button', { name: 'Xem lời giải' }).click();
  await expect(page.getByText(/Compa từ 90% xuống 85,7%/)).toBeVisible();
  await page.getByRole('button', { name: 'Hoàn thành và học tiếp' }).click();
  await page.getByRole('button', { name: 'Về kho kiến thức' }).click();
  await expect(page.getByText('2/4 bài đã hoàn thành')).toBeVisible();
  await page.reload();
  await expect(page.getByText('2/4 bài đã hoàn thành')).toBeVisible();
  await openReadingModule(page, 'Cấu trúc lương cơ bản');
  await expect(module.getByRole('button', { name: /^Học tiếp/ })).toHaveText(/Quy tắc tuyển và dịch chuyển/);
});

test('Hôm nay mở bài M01 đầu tiên chưa hoàn thành và khôi phục đúng bài qua URL', async ({ page }) => {
  await page.goto('./#hom-nay');
  const start = page.getByRole('link', { name: /^Bắt đầu M01/ });
  await expect(start).toHaveAttribute('href', '#lo-trinh?bai=trm-01-01');
  await start.click();
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveText('Thiết kế từ vấn đề kinh doanh');
  await expect(page).toHaveURL(/#lo-trinh\?bai=trm-01-01$/);
  await page.reload();
  await expect(title).toHaveText('Thiết kế từ vấn đề kinh doanh');
  await page.getByRole('button', { name: 'Hoàn thành và học tiếp' }).click();
  await expect(title).toHaveText('Xây dựng danh mục theo đối tượng');

  await openTab(page, 'hom-nay');
  const resume = page.getByRole('link', { name: /^Học tiếp/ });
  await expect(resume).toHaveAttribute('href', '#lo-trinh?bai=trm-01-02');
  await resume.click();
  await expect(title).toHaveText('Xây dựng danh mục theo đối tượng');
  await openTab(page, 'lo-trinh');
  await expect(title).toHaveText('Đọc và tự ôn Total Rewards');
  await page.goBack();
  await expect(title).toHaveText('Xây dựng danh mục theo đối tượng');
  await page.getByRole('button', { name: 'Về kho kiến thức' }).click();

  for (const lesson of ['Thực hiện và đo tác động', 'Xây dựng danh mục theo đối tượng', 'Triết lý trả lương thành quy tắc']) {
    const module = await openReadingModule(page, 'Chiến lược Total Rewards');
    await module.getByRole('button', { name: lesson, exact: true }).click();
    await page.getByRole('button', { name: 'Hoàn thành và học tiếp' }).click();
    await page.getByRole('button', { name: 'Về kho kiến thức' }).click();
    await expect(title).toHaveText('Đọc và tự ôn Total Rewards');
  }
  await openTab(page, 'hom-nay');
  await expect(resume).toHaveAttribute('href', '#lo-trinh?bai=trm-02-01');
});

test('mở thẻ M05, hẹn ôn hoặc bỏ hẹn rồi chấm thẻ đã chọn ở Hôm nay', async ({ page }, info) => {
  await page.addInitScript(watchCsp);
  await page.goto('./#lo-trinh');
  await openReadingModule(page, 'Cấu trúc lương cơ bản');
  await page.getByRole('button', { name: 'Diễn giải compa và penetration' }).click();
  const related = page.getByRole('region', { name: 'Thẻ liên quan' });
  const compa = related.locator('details').filter({ has: page.getByText('Compa-ratio', { exact: true }) });
  await expect(related.getByRole('button', { name: 'Đưa vào lịch ôn', includeHidden: true })).toHaveCount(0);
  await compa.locator('summary').click();
  await expect(compa.locator('.formula')).toBeVisible();
  await compa.getByRole('button', { name: 'Đưa vào lịch ôn' }).click();
  await expect(compa.getByRole('status')).toHaveText('Đã lên lịch');
  const found: string[] = [];
  await audit(page, 'm05-the-lien-quan', found);
  expect(found).toEqual([]);
  if (process.env.PW_SHOTS === 'roadmap' && info.project.name === 'iPhone SE') {
    await related.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: info.outputPath('m05-the-lien-quan.png') });
  }
  const range = related.locator('details').filter({ has: page.getByText('Range penetration', { exact: true }) });
  await range.locator('summary').click();
  await range.getByRole('button', { name: 'Đưa vào lịch ôn' }).click();
  await expect(range.getByRole('status')).toHaveText('Đã lên lịch');
  await range.getByRole('button', { name: 'Bỏ khỏi lịch ôn' }).click();
  await expect(range.getByRole('button', { name: 'Đưa vào lịch ôn' })).toBeEnabled();

  await openTab(page, 'hom-nay');
  const review = page.getByRole('button', { name: 'Ôn 1 thẻ từ bài đọc' });
  await expect(review).toBeVisible();
  await expect(page.getByTestId('st-today')).toHaveText('0');
  await page.reload();
  await review.click();
  await expect(page.getByRole('heading', { name: 'Compa-ratio' })).toBeVisible();
  await page.getByRole('button', { name: 'Lật thẻ' }).click();
  await page.getByRole('button', { name: /^Nhớ rõ/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong phiên ôn hôm nay');
  await page.reload();
  await expect(page.getByTestId('st-today')).toHaveText('1');
  await expect(review).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('đọc M06 và cân cả ma trận merit theo ngân sách', async ({ page }, info) => {
  await page.addInitScript(watchCsp);
  await page.goto('./#lo-trinh');
  const module = await openReadingModule(page, 'Hiệu suất và trả lương theo thành tích');
  await module.getByRole('button', { name: 'Thiết kế ma trận merit' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thiết kế ma trận merit');
  await expect(page.getByRole('heading', { name: 'Bối cảnh nghiệp vụ' })).toBeVisible();
  await expect(page.getByTestId('merit-summary')).toContainText(/Tăng gốc 51,20.*Ngân sách 50,00/);
  const result = page.getByTestId('merit-balanced');
  await expect(result).toContainText(/50,00 triệu\/tháng.*300,00 triệu\/6 tháng/);
  await page.getByLabel('Ngân sách (%)').fill('4,5');
  await expect(result).toContainText(/45,00 triệu\/tháng.*270,00 triệu\/6 tháng/);
  const month = page.getByLabel('Số tháng hiệu lực');
  await month.fill('13');
  await expect(result).toHaveCount(0);
  await month.fill('3');
  await expect(result).toContainText('135,00 triệu/3 tháng');
  const band = page.getByRole('group', { name: 'Vùng compa' }).getByRole('button', { name: '90–110%', exact: true });
  await band.click();
  await expect(band).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Quỹ ô (triệu đồng/tháng)').fill('200');
  await expect(result).toContainText('45,90 triệu/tháng');
  await page.getByRole('button', { name: 'Khôi phục số liệu mẫu' }).click();
  await expect(result).toContainText('300,00 triệu/6 tháng');
  await page.getByRole('button', { name: 'Xem lời giải' }).click();
  await expect(page.getByText(/Tổng tăng 52 triệu/)).toBeVisible();
  if (process.env.PW_SHOTS === 'roadmap' && info.project.name === 'iPhone SE') {
    await page.locator('#merit-title').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: info.outputPath('m06.png') });
  }
  await page.getByRole('button', { name: 'Hoàn thành và học tiếp' }).click();
  await page.getByRole('button', { name: 'Về kho kiến thức' }).click();
  await expect(module.getByText('1/4 bài đã hoàn thành')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  await page.reload();
  await expect(module.getByText('1/4 bài đã hoàn thành')).toBeVisible();
});

test('đọc M09 và so sánh lương theo FTE, grade và họ nghề', async ({ page }, info) => {
  await page.addInitScript(watchCsp);
  await page.goto('./#lo-trinh');
  const module = await openReadingModule(page, 'Phân tích dữ liệu đãi ngộ');
  await module.getByRole('button', { name: 'Đọc phân bố và nguyên nhân' }).click();
  await expect(page.getByRole('heading', { name: 'Bối cảnh nghiệp vụ' })).toBeVisible();
  const coverage = page.getByTestId('salary-coverage');
  const group = page.getByTestId('salary-group');
  await expect(coverage).toContainText('12/12 hồ sơ đủ dữ liệu tính compa');
  await expect(group).toContainText('100,86%');
  await expect(group).toContainText('99,57%');
  await page.getByRole('group', { name: 'Grade', exact: true }).getByRole('button', { name: 'G1', exact: true }).click();
  await expect(coverage).toContainText('4/4 hồ sơ đủ dữ liệu tính compa');
  await expect(group).toContainText('91,25%');
  await page.getByText(/^Hồ sơ mẫu · NV01/).click();
  await page.getByRole('button', { name: /^NV04 ·/ }).click();
  await expect(page.getByTestId('salary-detail')).toContainText('20,00 triệu');
  if (process.env.PW_SHOTS === 'roadmap' && info.project.name === 'iPhone SE') {
    await group.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: info.outputPath('m09.png') });
  }
  await page.getByLabel('Midpoint tại 1 FTE').fill('');
  await expect(coverage).toContainText('3/4 hồ sơ đủ dữ liệu tính compa');
  await expect(group).toContainText('88,33%');
  await page.getByRole('group', { name: 'Họ nghề', exact: true }).getByRole('button', { name: 'Kinh doanh', exact: true }).click();
  await expect(page.getByText(/Tổ hợp grade và họ nghề này chưa có hồ sơ/)).toBeVisible();
  await page.getByRole('button', { name: 'Khôi phục bảng mẫu' }).click();
  await expect(coverage).toContainText('12/12 hồ sơ đủ dữ liệu tính compa');
  await page.getByRole('button', { name: 'Hoàn thành và học tiếp' }).click();
  await page.getByRole('button', { name: 'Về kho kiến thức' }).click();
  await expect(module.getByText('1/4 bài đã hoàn thành')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  await page.reload();
  await expect(module.getByText('1/4 bài đã hoàn thành')).toBeVisible();
});

test('Tiến độ đếm riêng bài đọc từng mô-đun và giữ kết quả khi tải lại', async ({ page }) => {
  await page.goto('./#tien-do');
  const panel = page.getByRole('region', { name: 'Bài đọc theo mô-đun' });
  await expect(panel.getByText('0/4 bài đã đánh dấu hoàn thành')).toHaveCount(16);
  await expect(panel.getByText('0/5 bài đã đánh dấu hoàn thành')).toBeVisible();
  for (const id of ['trm-05-02', 'trm-06-01', 'trm-05-04']) {
    await page.goto(`./#lo-trinh?bai=${id}`);
    await page.getByRole('button', { name: 'Hoàn thành và học tiếp' }).click();
    await expect(page).not.toHaveURL(new RegExp(id + '$'));
  }
  await openTab(page, 'tien-do');
  await page.reload();
  for (const [code, count] of [['M05', '2'], ['M06', '1'], ['M09', '0']] as const) {
    const bar = panel.getByRole('progressbar', { name: new RegExp(code) });
    await expect(bar).toHaveAttribute('value', count);
    await expect(bar).toHaveAttribute('max', '4');
    await expect(bar.locator('..')).toContainText(`${count}/4 bài đã đánh dấu hoàn thành`);
  }
  await expect(page.getByTestId('pg-reviews')).toHaveText('0');
});

test('học liền 69 bài theo 17 buổi, lưu tiến độ và ôn lại sau bài cuối', async ({ page }, info) => {
  await page.goto('./#lo-trinh');
  test.slow(); // Đi qua cả 69 bài bằng nút hoàn thành thật.
  const stages = page.locator('section[aria-labelledby^="stage-"]');
  await expect(stages).toHaveCount(4);
  await expect(stages.getByRole('heading', { level: 2 })).toHaveText([
    'Nền tảng Total Rewards', 'Thiết kế lương và thưởng', 'Quản trị chương trình đãi ngộ', 'Đãi ngộ chuyên sâu',
  ]);
  const sessions = stages.getByRole('button', { expanded: false });
  await expect(sessions).toHaveCount(17);
  await expect(sessions.first()).toContainText('Buổi 1 · M01');
  await expect(sessions.last()).toContainText('Buổi 17 · M17');
  const findings: string[] = [];
  await audit(page, 'chuong-trinh', findings);
  expect(findings).toEqual([]);
  if (process.env.PW_SHOTS === 'course' && info.project.name === 'iPhone SE WebKit') {
    await page.screenshot({ path: info.outputPath('lo-trinh-iphone-se.png') });
  }
  await page.getByRole('link', { name: /^Bắt đầu M01/ }).click();
  for (let session = 1; session <= 17; session++) {
    const code = String(session).padStart(2, '0');
    const total = session === 4 ? 5 : 4;
    for (let number = 1; number <= total; number++) {
      await expect(page).toHaveURL(new RegExp(`#lo-trinh\\?bai=trm-${code}-0${number}$`));
      await expect(page.getByText(new RegExp(`^Buổi ${session} · .* · Bài ${number}/${total}$`))).toBeVisible();
      await page.getByRole('button', { name: /^Hoàn thành và / }).click();
    }
  }
  await expect(page).toHaveURL(/#lo-trinh$/);
  await page.reload();
  await expect(page.getByRole('progressbar', { name: '69/69 bài đã hoàn thành trong lộ trình' })).toHaveAttribute('value', '69');
  await openReadingModule(page, 'Cấu trúc lương cơ bản');
  await page.getByRole('button', { name: /^Ngoài dải và duy trì/ }).click();
  await expect(page.getByText('Đã hoàn thành', { exact: true })).toBeVisible();
  await openTab(page, 'hom-nay');
  await expect(page.getByText('Đã hoàn thành 69 bài trong lộ trình')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Ôn M01/ })).toHaveAttribute('href', '#lo-trinh?on=M01');
});

test('tự kiểm tra buổi M01, xem lời giải sau khi làm rồi mở lại kết quả đã lưu', async ({ page }) => {
  await page.addInitScript(watchCsp);
  await page.goto('./#lo-trinh');
  const module = await openReadingModule(page, 'Chiến lược Total Rewards');
  await module.getByRole('link', { name: 'Tự kiểm tra M01' }).click();
  const submit = page.getByRole('button', { name: 'Đối chiếu bài làm' });
  await expect(submit).toBeDisabled();
  await expect(page.getByText('Gợi ý đối chiếu')).toHaveCount(0);
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('radio').nth(6).check();
  await page.getByRole('textbox').fill('Đối chiếu thời gian xa nhà và lịch sử bổ nhiệm.');
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Đúng 2/2 câu trắc nghiệm' })).toBeVisible();
  await page.getByRole('button', { name: 'Cần ôn thêm' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tình huống cần ôn thêm' })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Bài làm của bạn.*Đối chiếu thời gian/)).toBeVisible();
  await expect(submit).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('thẻ thuật ngữ của buổi 17 đi từ bài đọc vào lịch ôn', async ({ page }) => {
  await page.goto('./#lo-trinh?bai=trm-17-04');
  const region = page.getByRole('region', { name: 'Thẻ liên quan' });
  const rsu = region.locator('details').filter({ hasText: 'Restricted Stock Units (RSU)' });
  await rsu.locator('summary').click();
  await rsu.getByRole('button', { name: 'Đưa vào lịch ôn' }).click();
  await expect(rsu.getByRole('status')).toHaveText('Đã lên lịch');
  await openTab(page, 'hom-nay');
  await page.getByRole('button', { name: 'Ôn 1 thẻ từ bài đọc' }).click();
  await expect(page.getByRole('heading', { name: 'Restricted Stock Units (RSU)' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem nghĩa' }).click();
  await page.getByRole('button', { name: /^Nhớ rõ/ }).click();
  await expect(page.getByRole('heading', { name: 'Xong phiên ôn hôm nay' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('st-today')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Ôn 1 thẻ từ bài đọc' })).toHaveCount(0);
});

test('chấm lại yếu tố ảnh hưởng và so sánh các hồ sơ của M04', async ({ page }) => {
  await page.addInitScript(watchCsp);
  await page.goto('./#lo-trinh?bai=trm-04-05');
  const practice = page.getByRole('region', { name: 'Thử chấm điểm và xếp ngạch' });
  const score = practice.getByRole('status');
  await expect(score).toContainText('53/100 điểm · Ngạch G2');
  await practice.getByRole('group', { name: 'Ảnh hưởng' }).getByRole('button', { name: 'Cấp 3' }).click();
  await expect(score).toContainText('60/100 điểm · Ngạch G3');
  await practice.getByRole('button', { name: 'Chuyên gia kỹ thuật' }).click();
  await expect(score).toContainText('78/100 điểm · Ngạch G4');
  await practice.getByRole('button', { name: 'Kỹ sư hiện trường' }).click();
  await expect(score).toContainText('60/100 điểm · Ngạch G3');
  await practice.getByRole('button', { name: 'Khôi phục hồ sơ này' }).click();
  await expect(score).toContainText('53/100 điểm · Ngạch G2');
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});
