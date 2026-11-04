import { expect, test } from '@playwright/test';
import { walkApp } from './helpers/audit';
import { stubMedia } from './helpers/stubs';

/**
 * Chụp các màn chính vào docs/screenshots/s9-<máy>-<sáng|tối>-<màn>.png (chỉ chạy khi PW_SHOTS=1):
 *   PW_SHOTS=1 npx playwright test screenshots
 * Ảnh cỡ chữ (mặc định và Rất lớn) vào docs/screenshots/type-<máy>-<cỡ>-<sáng|tối>-<màn>.png:
 *   PW_SHOTS=type npx playwright test screenshots
 */
const SHOTS = new Set([
  'hom-nay',
  'phien-ngay',
  'tr-the-lat',
  'tr-bai-tinh-dap-an',
  'en-the-tu-lat',
  'en-cau-mau-thay-tu',
  'en-shadowing-bai',
  'en-luyen-noi',
  'en-de-noi-ghi-am',
  'tra-cuu-en',
  'tien-do',
  'cai-dat',
]);

/** Màn cần cuộn tới phần đang thao tác (mặc định: đầu trang). */
const FOCUS: Record<string, string> = {
  'tr-the-lat': '.back',
  'tr-bai-tinh-dap-an': '.fb',
  'en-the-tu-lat': '.back',
  'en-cau-mau-thay-tu': '.en-slots',
  'en-luyen-noi': '[data-testid="say-result"]',
  'en-de-noi-ghi-am': '.rec-box',
};

test.skip(!process.env.PW_SHOTS, 'Chỉ chụp khi đặt PW_SHOTS');
test.use({ deviceScaleFactor: 2 });

for (const scheme of ['light', 'dark'] as const) {
  test(`chụp màn hình (${scheme})`, async ({ page }, info) => {
    test.skip(process.env.PW_SHOTS !== '1');
    test.slow();
    const device = info.project.name.toLowerCase().replace(/\s+/g, '');
    await page.addInitScript(stubMedia);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    let n = 0;
    await walkApp(page, async (where) => {
      if (!SHOTS.has(where)) return;
      await page.evaluate((sel) => {
        const el = sel ? document.querySelector(sel) : null;
        if (el) el.scrollIntoView({ block: 'center' });
        else window.scrollTo(0, 0);
      }, FOCUS[where] ?? '');
      await page.waitForTimeout(150);
      await page.screenshot({ path: `docs/screenshots/s9-${device}-${scheme === 'light' ? 'sang' : 'toi'}-${where}.png` });
      n++;
    });
    expect(n).toBe(SHOTS.size);
  });
}

const TYPE_SHOTS = new Set(['hom-nay', 'tr-the-lat', 'en-shadowing-bai', 'tien-do', 'cai-dat']);

for (const size of ['mac-dinh', 'rat-lon'] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`chụp cỡ chữ ${size} (${scheme})`, async ({ page }, info) => {
      test.skip(process.env.PW_SHOTS !== 'type');
      test.slow();
      const device = info.project.name.toLowerCase().replace(/\s+/g, '');
      await page.addInitScript(stubMedia);
      if (size === 'rat-lon') await page.addInitScript(() => localStorage.setItem('ds.fontSize', 'xl'));
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      let n = 0;
      await walkApp(page, async (where) => {
        if (!TYPE_SHOTS.has(where)) return;
        await page.evaluate((sel) => {
          const el = sel ? document.querySelector(sel) : null;
          if (el) el.scrollIntoView({ block: 'center' });
          else window.scrollTo(0, 0);
        }, FOCUS[where] ?? '');
        await page.waitForTimeout(150);
        await page.screenshot({ path: `docs/screenshots/type-${device}-${size}-${scheme === 'light' ? 'sang' : 'toi'}-${where}.png` });
        n++;
      });
      expect(n).toBe(TYPE_SHOTS.size);
    });
  }
}
