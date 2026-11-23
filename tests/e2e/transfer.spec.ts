import { expect, test } from '@playwright/test';

test('ngày 7 và 30 sau khóa: đổi tình huống, mở memo sau trả lời và lưu tiêu chí', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-23T12:00:00+07:00'));
  await page.goto('/#lo-trinh');
  await expect(page.getByRole('progressbar', { name: /0\/69/ })).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('daily-study');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['settings', 'notes'], 'readwrite');
        for (let m = 1; m <= 17; m++) for (let l = 1; l <= (m === 4 ? 5 : 4); l++) {
          if (m === 17 && l === 4) continue;
          const id = 'trm-' + String(m).padStart(2, '0') + '-0' + l;
          tx.objectStore('settings').put({ key: 'tr.roadmap.' + id, value: true });
        }
        tx.objectStore('notes').put({ id: 'trm-08-02', text: 'Đối chiếu quyền duyệt chi', at: Date.now() });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.goto('/#lo-trinh?bai=trm-17-04'); await page.reload();
  await page.getByRole('button', { name: /^Hoàn thành và / }).click();
  const panel = page.getByRole('region', { name: 'Vận dụng sau 7 và 30 ngày' });
  await expect(panel).toContainText('30/11/2026');
  await expect(panel.getByRole('button', { name: /Làm tình huống/ })).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-11-30T12:00:00+07:00')); await page.reload();
  await panel.getByRole('button', { name: 'Làm tình huống ngày 7' }).click();
  await expect(panel.getByText('Xem memo các buổi liên quan')).toHaveCount(0);
  await panel.getByRole('textbox').fill('Tôi chọn Y vì cùng quản lý một điểm, rồi kiểm tra biến động chín tháng.');
  await panel.getByRole('button', { name: 'Đối chiếu rồi mở memo' }).click();
  await panel.getByText('Xem memo các buổi liên quan').click();
  await expect(panel.getByText(/Đối chiếu quyền duyệt chi/)).toBeVisible();
  await panel.getByRole('checkbox').first().check();
  await panel.getByRole('button', { name: 'Lưu tự đánh giá' }).click();
  await expect(panel).toContainText('đạt 1/3 tiêu chí');
  await page.clock.setFixedTime(new Date('2026-12-23T12:00:00+07:00')); await page.reload();
  await expect(panel).toContainText('đạt 1/3 tiêu chí');
  await panel.getByRole('button', { name: 'Làm tình huống ngày 30' }).click();
  await expect(panel.getByText(/Giám đốc nhà máy đề xuất tăng 4%/)).toBeVisible();
});
