import { expect, test, type Page } from '@playwright/test';
import { audit, openTab, trackErrors, walkApp } from './helpers/audit';
import { stubMedia, watchCsp } from './helpers/stubs';

/**
 * Cỡ chữ lớn (Dynamic Type): đi hết các màn như audit.spec.ts nhưng ở
 * - "Rất lớn" chọn trong app (15 px × 1,3 = 19,5 px), và
 * - mức Trợ năng › Chữ lớn hơn của iOS, giả lập bằng cỡ gốc 23 px và 28 px (Safari đặt -apple-system-body cỡ đó).
 * Mỗi màn kiểm như audit thường (tràn ngang, chữ tràn hộp, vùng chạm ≥ 44 px, tương phản) và thêm:
 * thanh tab dùng được (đủ 4 tab, nằm gọn trong màn, không bị cắt), thanh trên không che quá nửa màn,
 * chữ không bị cắt dọc trong hộp overflow: hidden.
 */
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(watchCsp);
  await page.addInitScript(stubMedia);
});

/** Giả lập cỡ chữ gốc của máy (iOS: -apple-system-body) — chạy trước mã trang. */
const rootPx = (px: number) => {
  const set = () => document.documentElement.style.setProperty('font-size', `${px}px`, 'important');
  if (document.documentElement) set();
  else document.addEventListener('DOMContentLoaded', set);
};

/** Kiểm thêm cho chữ lớn (chạy trong trình duyệt). */
function auditLarge(): string[] {
  const out: string[] = [];
  const vw = document.documentElement.clientWidth;
  const nav = document.querySelector('nav.tabs');
  const tabs = [...document.querySelectorAll<HTMLAnchorElement>('nav.tabs a')];
  if (!nav || tabs.length !== 5) out.push(`thanh tab: thấy ${tabs.length}/5 tab`);
  else {
    const nr = nav.getBoundingClientRect();
    for (const a of tabs) {
      const r = a.getBoundingClientRect();
      if (r.left < nr.left - 0.5 || r.right > nr.right + 0.5 || r.right > vw + 0.5) out.push(`tab “${a.textContent}” bị khuất (phải cuộn thanh tab)`);
      if (a.scrollWidth > a.clientWidth + 1) out.push(`tab “${a.textContent}” bị cắt chữ (${a.scrollWidth} > ${a.clientWidth})`);
      if (r.height < 43.5 || r.width < 43.5) out.push(`tab “${a.textContent}” ${Math.round(r.width)}×${Math.round(r.height)} < 44`);
    }
  }
  const top = document.querySelector('.top');
  // Chữ lớn: thanh trên vẫn position: sticky nhưng top âm cả màn (= cuộn đi như thường).
  if (top && getComputedStyle(top).position === 'sticky' && parseFloat(getComputedStyle(top).top) >= 0) {
    const h = top.getBoundingClientRect().height;
    if (h > innerHeight * 0.4) out.push(`thanh trên dính (sticky) cao ${Math.round(h)}px > 40% màn (${innerHeight}px)`);
  }
  // Chữ bị cắt dọc: hộp cắt nội dung (overflow ≠ visible) mà chữ cao hơn hộp. Bỏ qua vùng tự cuộn và chữ ẩn cho trình đọc màn hình.
  for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
    const cs = getComputedStyle(el);
    if (cs.overflowY !== 'hidden' && cs.overflowY !== 'clip') continue;
    if (el.closest('.sr-only, .say-sr') || !el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.scrollHeight > el.clientHeight + 1) out.push(`chữ bị cắt dọc: ${el.tagName.toLowerCase()}.${el.className} (${el.scrollHeight} > ${el.clientHeight})`);
  }
  return out;
}

async function check(page: Page, where: string, found: string[]) {
  await audit(page, where, found);
  for (const i of await page.evaluate(auditLarge)) found.push(`[${where}] ${i}`);
}

const VARIANTS = [
  { name: 'Rất lớn (19,5 px)', fs: 'xl', px: 0, scheme: 'light', width: 0 },
  { name: 'Rất lớn (19,5 px), tối', fs: 'xl', px: 0, scheme: 'dark', width: 0 },
  { name: 'Trợ năng 23 px', fs: '', px: 23, scheme: 'light', width: 0 },
  { name: 'Trợ năng 28 px', fs: '', px: 28, scheme: 'light', width: 0 },
  { name: 'Trợ năng 28 px, tối', fs: '', px: 28, scheme: 'dark', width: 0 },
  { name: 'Rất lớn (19,5 px), rộng 375px', fs: 'xl', px: 0, scheme: 'light', width: 375 },
  { name: 'Trợ năng 28 px, rộng 375px', fs: '', px: 28, scheme: 'light', width: 375 },
] as const;

for (const v of VARIANTS) {
  test(`chữ lớn — quét mọi màn: ${v.name}`, async ({ page }, info) => {
    test.slow();
    test.skip(!!v.width && !info.project.name.startsWith('iPhone 14'), '375px chỉ cần chạy một lần');
    if (v.width) await page.setViewportSize({ width: v.width, height: 667 });
    if (v.fs) await page.addInitScript((fs) => localStorage.setItem('ds.fontSize', fs), v.fs);
    if (v.px) await page.addInitScript(rootPx, v.px);
    await page.emulateMedia({ colorScheme: v.scheme });
    const errors = trackErrors(page);
    const found: string[] = [];
    await walkApp(page, async (where) => {
      if (where === 'hom-nay') {
        const want = v.px || 19.5;
        expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(want, 1);
      }
      await check(page, where, found);
    });
    expect(found, found.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('Cài đặt › Cỡ chữ: đổi ngay, lưu lại, áp dụng trước lần render đầu', async ({ page }) => {
  const rootPxNow = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  await openTab(page, 'cai-dat');
  const group = page.getByRole('group', { name: 'Cỡ chữ' });
  await expect(group.getByRole('button', { name: 'Theo máy', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const base = await rootPxNow();
  for (const [label, k] of [['Nhỏ', 0.9], ['Vừa', 1], ['Lớn', 1.15], ['Rất lớn', 1.3]] as const) {
    await group.getByRole('button', { name: label, exact: true }).click();
    await expect(group.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await rootPxNow()).toBeCloseTo(15 * k, 1);
  }
  // Mở lại app: <html data-fs> đã có trước khi React vẽ nội dung đầu tiên (không nháy cỡ chữ).
  await page.addInitScript(() => {
    const w = window as unknown as { __fsAtFirstRender?: string | null };
    new MutationObserver((_, obs) => {
      if (document.getElementById('root')?.childElementCount) {
        w.__fsAtFirstRender = document.documentElement.getAttribute('data-fs');
        obs.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __fsAtFirstRender?: string }).__fsAtFirstRender)).toBe('xl');
  expect(await rootPxNow()).toBeCloseTo(19.5, 1);
  await expect(page.getByRole('group', { name: 'Cỡ chữ' }).getByRole('button', { name: 'Rất lớn' })).toHaveAttribute('aria-pressed', 'true');
  // Về "Theo máy": bỏ data-fs, cỡ gốc như lúc đầu.
  await page.getByRole('group', { name: 'Cỡ chữ' }).getByRole('button', { name: 'Theo máy', exact: true }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-fs', /.*/);
  expect(await rootPxNow()).toBeCloseTo(base, 1);
});

test('chữ lớn — dải nhắc sao lưu trên Hôm nay và phần sao lưu trong Cài đặt', async ({ page }) => {
  test.slow();
  const DAY = 86_400_000;
  const T0 = new Date('2026-11-01T09:00:00+07:00').getTime();
  const btn = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
  await page.clock.setFixedTime(T0);
  // Có một ngày ôn, rồi 15 ngày sau chưa sao lưu → dải nhắc hiện.
  await page.goto('./#hom-nay');
  await page.getByRole('button', { name: /^Thẻ từ/ }).click();
  await btn('Lật thẻ').click();
  await btn(/^Nhớ rõ/).click();
  await btn('Kết thúc').click();
  await page.clock.setFixedTime(T0 + 15 * DAY);
  const found: string[] = [];
  for (const [label, init] of [
    ['Rất lớn', () => localStorage.setItem('ds.fontSize', 'xl')],
    ['28 px', () => document.documentElement.style.setProperty('font-size', '28px', 'important')],
  ] as const) {
    await page.addInitScript(init);
    await page.reload();
    await expect(page.getByTestId('backup-nudge')).toBeVisible();
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.getByTestId('backup-nudge').scrollIntoViewIfNeeded();
      await check(page, `nhắc sao lưu ${label} ${scheme}`, found);
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await page.getByRole('link', { name: 'Sao lưu ngay' }).click();
    await expect(page).toHaveURL(/#cai-dat$/);
    await check(page, `cài đặt sao lưu ${label}`, found);
    await openTab(page, 'hom-nay');
  }
  expect(found, found.join('\n')).toEqual([]);
});

test('đáp án trắc nghiệm có từ dài xuống dòng ở màn 320px và cỡ chữ 23px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(rootPx, 23);
  await page.goto('./#hom-nay');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('daily-study');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const store = request.result;
      const write = store.transaction('settings', 'readwrite');
      write.oncomplete = () => { store.close(); resolve(); };
      write.onerror = () => { store.close(); reject(write.error); };
      const at = Date.now();
      write.objectStore('settings').put({
        key: 'session.active',
        value: { kind: 'tr', items: [{ id: 'tr:Q088' }], pos: 0, results: [], t0: at, minutes: 5, savedAt: at },
      });
    };
  }));
  await page.reload();
  await page.getByTestId('resume-panel').getByRole('button', { name: 'Tiếp tục' }).click();
  const answer = page.getByRole('button', { name: /Person\/competency assessment/ });
  await expect(answer).toBeVisible();
  expect(await answer.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  await answer.click();
  expect(await answer.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
});
