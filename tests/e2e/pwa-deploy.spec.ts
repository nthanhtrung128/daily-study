import { expect, test, type Page } from '@playwright/test';

/**
 * S9a: header khi deploy (vite preview đọc public/_headers như Cloudflare Pages), CSP không làm hỏng app,
 * PWA trên iOS (manifest, icon, theme-color), không cuộn ngang ở 320/375px, offline gồm nội dung EN.
 */

/** Ghi lại mọi vi phạm CSP vào window.__csp (sự kiện securitypolicyviolation, có ở Chromium và WebKit). */
const watchCsp = () => {
  const w = window as unknown as { __csp: string[] };
  w.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    w.__csp.push(`${e.effectiveDirective} ← ${e.blockedURI || '(inline)'}`);
  });
};
const cspViolations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

/** speechSynthesis rỗng để bấm Nghe/Phát không phụ thuộc giọng của máy chạy test. */
const stubSpeech = () => {
  const synth = { speak() {}, cancel() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
};

const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(watchCsp);
  await page.addInitScript(stubSpeech);
});

test('header bảo mật và cache giống Cloudflare Pages; robots.txt chặn tất cả', async ({ request }) => {
  const root = await request.get('./');
  const h = root.headers();
  expect(h['content-security-policy']).toContain("script-src 'self'");
  expect(h['content-security-policy']).not.toContain('unsafe-');
  expect(h['permissions-policy']).toContain('microphone=(self)');
  expect(h['referrer-policy']).toBe('no-referrer');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-robots-tag']).toContain('noindex');
  expect(h['cache-control']).toBe('no-cache');

  const html = await root.text();
  const js = /src="\.\/(assets\/index-[^"]+\.js)"/.exec(html)?.[1];
  expect(js).toBeTruthy();
  expect((await request.get(js!)).headers()['cache-control']).toContain('immutable');
  expect((await request.get('sw.js')).headers()['cache-control']).toBe('no-cache');

  const robots = await request.get('robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toMatch(/User-agent: \*\s+Disallow: \/\s*$/);
});

test('PWA cho iPhone: manifest có credentials, icon tải được, apple-touch-icon 180px, theme-color sáng/tối', async ({ page, request }) => {
  await page.goto('./');
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute('crossorigin', 'use-credentials');
  const manifest = (await (await request.get((await manifestLink.getAttribute('href'))!)).json()) as {
    display: string;
    start_url: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./#hom-nay');
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const r = await request.get(icon.src);
    expect(r.ok(), icon.src).toBe(true);
    expect(r.headers()['content-type']).toContain('image/png');
  }

  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const size = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, touch!);
  expect(size).toEqual([180, 180]);

  const themes = await page.locator('meta[name="theme-color"]').evaluateAll((els) =>
    els.map((e) => `${e.getAttribute('media')}=${e.getAttribute('content')}`),
  );
  expect(themes).toEqual(['(prefers-color-scheme: light)=#EEF1F4', '(prefers-color-scheme: dark)=#0E1318']);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  expect(await cspViolations(page)).toEqual([]);
});

for (const width of [320, 375]) {
  test(`rộng ${width}px: mọi trang và màn ôn không cuộn ngang, không vi phạm CSP (sáng + tối)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    const check = async (where: string) => {
      expect(await overflowX(page), where).toBeLessThanOrEqual(0);
    };

    for (const theme of ['Sáng', 'Tối']) {
      await page.goto('./#cai-dat');
      await page.getByRole('button', { name: theme, exact: true }).click();
      for (const hash of ['hom-nay', 'tra-cuu', 'tien-do', 'cai-dat']) {
        await page.goto(`./#${hash}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await check(`${theme} #${hash}`);
      }
    }

    // Tra cứu: mở một mục TR và một cụm EN.
    await page.goto('./#tra-cuu');
    await page.getByRole('searchbox').fill('tong dai ngo');
    await page.locator('details.item summary').first().click();
    await check('tra cứu TR');
    await page.getByRole('searchbox').fill('touch base');
    await page.locator('details.item summary').first().click();
    await check('tra cứu EN');

    // Phiên TR: thẻ ghi nhớ.
    await page.goto('./#hom-nay');
    await page.getByRole('button', { name: '5 phút', exact: true }).click();
    await page.getByRole('button', { name: 'Thẻ ghi nhớ' }).click();
    await page.getByRole('button', { name: 'Bắt đầu 5 phút' }).click();
    await page.getByRole('button', { name: 'Lật thẻ' }).click();
    await check('thẻ TR');
    await page.getByRole('button', { name: 'Kết thúc' }).click();
    await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();

    // Tiếng Anh: thẻ từ, shadowing hội thoại.
    await page.getByRole('button', { name: /^Thẻ từ/ }).click();
    await page.getByRole('button', { name: 'Lật thẻ' }).click();
    await check('thẻ từ EN');
    await page.getByRole('button', { name: 'Kết thúc' }).click();
    await page.getByRole('button', { name: 'Về trang Hôm nay' }).click();
    await page.getByRole('button', { name: /^Shadowing/ }).click();
    await page.getByRole('button', { name: /Họp · phần 1/ }).click();
    await check('shadowing');

    await page.goto('./#tien-do');
    await check('tiến độ sau khi ôn');
    expect(await cspViolations(page)).toEqual([]);
  });
}

test('offline sau lần mở đầu: mọi trang và nội dung EN (cụm từ, hội thoại) vẫn dùng được', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  for (const hash of ['tien-do', 'cai-dat', 'tra-cuu', 'hom-nay']) {
    await page.goto(`./#${hash}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page.reload();
  await page.getByRole('button', { name: /^Shadowing/ }).click();
  await expect(page.getByRole('button', { name: /Họp · phần 1/ })).toBeVisible();
  await page.goto('./#tra-cuu');
  await page.getByRole('searchbox').fill('touch base');
  await expect(page.locator('summary b', { hasText: /^touch base$/ })).toBeVisible();
  expect(await cspViolations(page)).toEqual([]);
  await context.setOffline(false);
});

test('/dang-nhap không lấy từ cache service worker (để Cloudflare Access đăng nhập lại), vẫn mở được app', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Offline: trang thường vẫn mở từ cache, còn /dang-nhap phải ra mạng nên lỗi.
  await context.setOffline(true);
  await page.goto('./#tien-do');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tiến độ');
  await expect(page.goto('./dang-nhap')).rejects.toThrow();
  await context.setOffline(false);

  const res = await page.goto('./dang-nhap');
  expect(res?.fromServiceWorker()).toBe(false);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hôm nay ôn bao lâu?');
  expect(await cspViolations(page)).toEqual([]);
});
