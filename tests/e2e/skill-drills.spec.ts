import { expect, test } from '@playwright/test';

test('Hôm nay chỉ hẹn câu cần ôn, đổi tình huống ngày sau và lưu khi trả lời đúng', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-23T12:00:00+07:00'));
  await page.goto('/#lo-trinh');
  await expect(page.getByRole('progressbar')).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('daily-study');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({ key: 'tr.transfer.30', value: { at: Date.now(), response: 'Đã giải trình chi phí.', criteria: [true, false, true] } });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  await page.goto('/#hom-nay');
  const panel = page.getByRole('region', { name: 'Ôn theo tiêu chí cần luyện' });
  await expect(panel).toContainText('24/11/2026');
  await expect(panel.getByRole('textbox')).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00+07:00')); await page.reload();
  await panel.getByRole('textbox').fill('60');
  await panel.getByRole('button', { name: 'Đối chiếu câu ôn' }).click();
  await expect(panel).toContainText('144 triệu');
  await panel.getByRole('button', { name: 'Xem lịch tiếp theo' }).click();
  await expect(panel).toContainText('25/11/2026');
  await page.clock.setFixedTime(new Date('2026-11-25T12:00:00+07:00')); await page.reload();
  await expect(panel).toContainText('16 người');
  await panel.getByRole('textbox').fill('192');
  await panel.getByRole('button', { name: 'Đối chiếu câu ôn' }).click();
  await expect(panel).toContainText('Đúng. Đã hoàn thành');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Trung tâm học tập', exact: true })).toBeVisible();
  await expect(panel).toHaveCount(0);
});
