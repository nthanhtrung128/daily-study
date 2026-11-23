import { expect, test } from '@playwright/test';
test('giữ phiếu cũ khi nộp đề xuất mới và đối chiếu hai ngày', async ({ page }) => {
  await page.goto('/#lo-trinh');
  await expect(page.getByRole('progressbar')).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('daily-study');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['settings', 'recordings'], 'readwrite');
        for (let i = 0; i < 4; i++) {
          const data = new ArrayBuffer(46);
          const view = new DataView(data);
          for (const [pos, word] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) for (let j = 0; j < word.length; j++) view.setUint8(pos + j, word.charCodeAt(j));
          for (const [pos, val] of [[4, 38], [16, 16], [24, 8000], [28, 16000], [40, 2]] as const) view.setUint32(pos, val, true);
          for (const [pos, val] of [[20, 1], [22, 1], [32, 2], [34, 16]] as const) view.setUint16(pos, val, true);
          tx.objectStore('recordings').add({ topicId: i < 3 ? 'tr-capstone-retention' : 'tr-case-offers', title: 'Mẫu âm thử', at: Date.now() - (4 - i) * 86400000, ms: 1000, mime: 'audio/wav', data, size: data.byteLength });
        }
        tx.objectStore('settings').put({ key: 'tr.transfer.capstone', value: { at: Date.now() - 7 * 86400000, response: 'Đề xuất đã nộp từ tuần trước.', criteria: [false, false, false] } });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      }; req.onerror = () => reject(req.error);
    });
  });
  await page.goto('/#lo-trinh?tong-ket=1');
  await page.getByRole('button', { name: 'Làm lại đề xuất' }).click();
  await page.getByRole('radio', { name: /^Y ·/ }).check();
  for (const [label, n] of [['A trong năm', '96'], ['A đủ 12 tháng', '192'], ['B trong năm', '36'], ['B đủ 12 tháng', '144']]) await page.getByLabel(label!).fill(n!);
  await page.getByRole('radio', { name: 'B', exact: true }).check();
  await page.getByLabel(/^Viết đề xuất/).fill('Đề xuất lần hai trong ngân sách.');
  await page.getByRole('radio', { name: 'Đã làm được' }).check();
  await page.getByRole('button', { name: 'Lưu đề xuất và đối chiếu' }).click();
  await page.getByRole('link', { name: 'So sánh các lần làm ở Tiến độ' }).click();
  const panel = page.getByRole('region', { name: 'Hồ sơ tiến bộ' });
  await expect(panel.locator('audio')).toHaveCount(2);
  await expect(panel.locator('audio').first()).toHaveAttribute('src', /^blob:/);
  await expect(panel).toContainText('Lần trước: Cần luyện · Gần nhất: Đạt');
  await panel.getByText('Đọc phiếu lần trước').click();
  await expect(panel).toContainText('Đề xuất đã nộp từ tuần trước.');
  await panel.getByRole('button', { name: 'Hai thư mời' }).click();
  await expect(panel).toContainText('Chưa có phiếu');
  await expect(panel.locator('audio')).toHaveCount(1);
});
