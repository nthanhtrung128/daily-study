// Sinh icon PNG từ public/icons/icon.svg bằng Chromium của Playwright.
// Chạy: npm run icons (chỉ cần khi đổi icon; file PNG đã được commit).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const svg = readFileSync(dir + 'icon.svg', 'utf8');
const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

// maskable: nền tràn viền, nội dung thu vào vùng an toàn 80%.
const targets = [
  { file: 'icon-192.png', size: 192, mode: 'plain' },
  { file: 'icon-512.png', size: 512, mode: 'plain' },
  { file: 'icon-maskable-512.png', size: 512, mode: 'maskable' },
  { file: 'apple-touch-icon.png', size: 180, mode: 'maskable' },
];

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  const inner = t.mode === 'maskable' ? Math.round(t.size * 0.8) : t.size;
  const bg = t.mode === 'maskable' ? '#1D5BC4' : 'transparent';
  await page.setContent(
    `<html><body style="margin:0;width:${t.size}px;height:${t.size}px;background:${bg};display:grid;place-items:center">` +
      `<img src="${dataUrl}" width="${inner}" height="${inner}"></body></html>`,
  );
  await page.screenshot({ path: dir + t.file, omitBackground: t.mode === 'plain' });
  await page.close();
}
await browser.close();
console.log('Đã sinh icon:', targets.map((t) => t.file).join(', '));
