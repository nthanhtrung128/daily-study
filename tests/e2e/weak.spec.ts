import { expect, test, type Page } from '@playwright/test';
import { wordKey } from '../../src/core/misswords';
import { audit, openTab } from './helpers/audit';
import { stubMedia } from './helpers/stubs';

test.use({ serviceWorkers: 'block' });

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
/** Chụp ảnh cho mô tả PR khi đặt PW_SHOTS=weak (bình thường không chụp). */
const shot = async (page: Page, project: string, name: string) => {
  if (process.env.PW_SHOTS === 'weak' && project === 'iPhone 14') await page.screenshot({ path: `docs/screenshots/weak-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(stubMedia);
});

test('ôn điểm yếu: chấm sai vài mục → Hôm nay hiện "Ôn điểm yếu" → chạy hết phiên → hết điểm yếu', async ({ page }, info) => {
  const P = info.project.name;
  const found: string[] = [];
  const btn = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
  await page.goto('./#hom-nay');
  // Chưa có điểm yếu: trạng thái rỗng thân thiện, không có nút bắt đầu.
  await expect(page.getByTestId('weak-empty')).toBeVisible();
  await expect(btn(/^Ôn điểm yếu \(/)).toHaveCount(0);

  // (a) Nghe chép 2 câu, mỗi câu gõ sai đúng một từ (từ dài nhất) → 2 "từ hay sai".
  // Làm trước phần thẻ từ: nghe chép ưu tiên câu của thẻ đến hạn, sẽ chấm lại chính thẻ vừa Quên.
  await btn(/^Nghe chép/).click();
  const box = page.getByRole('textbox', { name: 'Gõ lại câu bạn nghe được' });
  const missed: string[] = [];
  for (let k = 0; k < 2; k++) {
    await btn('Nghe câu').click();
    const words = ((await spoken(page)).at(-1) ?? '').trim().split(/\s+/);
    const long = words.reduce((a, w) => (wordKey(w).length > wordKey(a).length ? w : a), '');
    missed.push(wordKey(long));
    await box.fill(words.map((w) => (w === long ? 'zzzz' : w)).join(' '));
    await btn('Kiểm tra').click();
    await expect(page.getByTestId('dict-score')).not.toHaveText('100%');
    await btn('Câu tiếp').click();
  }
  await btn('Kết thúc').click();
  await btn('Về trang Hôm nay').click();

  // (b) Chấm Quên 2 thẻ từ.
  await btn(/^Thẻ từ/).click();
  for (let k = 0; k < 2; k++) {
    await btn('Lật thẻ').click();
    await btn(/^Quên/).click();
  }
  await btn('Kết thúc').click();
  await btn('Về trang Hôm nay').click();

  // Tiến độ: khối "Từ hay sai" có các từ vừa sai, có nút nghe.
  await openTab(page, 'tien-do');
  const list = page.getByTestId('miss-list');
  await list.scrollIntoViewIfNeeded();
  for (const w of new Set(missed)) await expect(list.getByText(w, { exact: true })).toBeVisible();
  await list.getByRole('button', { name: `Nghe: ${missed[0]}` }).click();
  expect((await spoken(page)).at(-1)).toBe(missed[0]);
  await audit(page, 'tien-do-tu-hay-sai', found);
  await shot(page, P, '4-tu-hay-sai');

  // Hôm nay: hiện "Ôn điểm yếu (n mục)" = 2 thẻ từ + câu chứa từ sai.
  await openTab(page, 'hom-nay');
  const go = btn(/^Ôn điểm yếu \(\d+ mục\)$/);
  await go.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('weak-sum')).toContainText('2 mục tiếng Anh');
  await expect(page.getByTestId('weak-sum')).toContainText('câu có từ hay sai');
  await audit(page, 'hom-nay-diem-yeu', found);
  await shot(page, P, '1-hom-nay');
  const total = Number(/\((\d+) mục\)/.exec((await go.textContent()) ?? '')?.[1]);
  expect(total).toBeGreaterThanOrEqual(3);
  await go.click();

  // Chạy hết phiên bằng chính các thẻ của phiên hằng ngày, trả lời đúng tất cả.
  const count = page.getByTestId('sess-count');
  const kinds: string[] = [];
  for (let k = 0; k < total; k++) {
    await expect(count).toHaveText(`${k + 1}/${total}`);
    if ((await box.count()) > 0) {
      await btn('Nghe câu').click();
      await box.fill((await spoken(page)).at(-1) ?? '');
      if (!kinds.includes('dict')) {
        await audit(page, 'diem-yeu-nghe-chep', found);
        await shot(page, P, '3-nghe-chep');
      }
      await btn('Kiểm tra').click();
      await expect(page.getByTestId('dict-score')).toHaveText('100%');
      await btn(/^(Câu tiếp|Xem kết quả)$/).click();
      kinds.push('dict');
    } else if ((await page.getByTestId('say-target').count()) > 0) {
      const target = (await page.getByTestId('say-target').textContent()) ?? '';
      await page.evaluate((s) => ((window as unknown as { __nextSay: string }).__nextSay = s), target);
      await btn('Nói thử').click();
      await btn(/^Tiếp · /).click();
      kinds.push('say');
    } else {
      if (k === 0) {
        await audit(page, 'diem-yeu-the', found);
        await shot(page, P, '2-phien');
      }
      await btn('Lật thẻ').click();
      await btn(/^Nhớ rõ/).click();
      kinds.push('card');
    }
    if (k === 0) {
      await expect(count).toHaveText(`2/${total}`);
      await page.reload();
      const resume = page.getByTestId('resume-panel');
      await expect(resume).toContainText(`(1/${total})`);
      await resume.getByRole('button', { name: 'Tiếp tục' }).click();
    }
  }
  expect(kinds.filter((x) => x === 'card')).toHaveLength(2);
  expect(kinds).toContain('dict');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong phiên ôn điểm yếu');
  await expect(page.getByTestId('mix-dict')).toContainText('Nghe chép');
  await expect(btn('Ôn thêm 5 phút')).toHaveCount(0);
  await audit(page, 'diem-yeu-ket-qua', found);
  await btn('Về trang Hôm nay').click();

  // Chấm đúng hết → độ yếu giảm, không còn điểm yếu.
  await expect(page.getByTestId('weak-empty')).toBeVisible();
  expect(found).toEqual([]);
});
