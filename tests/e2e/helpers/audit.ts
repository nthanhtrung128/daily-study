import { expect, type Page } from '@playwright/test';

/**
 * Kiểm tra giao diện trên trang đang mở (chạy trong trình duyệt):
 * - tràn ngang: trang cuộn ngang, hoặc phần tử vượt mép màn hình (không nằm trong vùng tự cuộn/cắt);
 * - chữ tràn khỏi hộp của nó;
 * - vùng chạm < 44×44 px (nút, link, summary, ô nhập, audio);
 * - tương phản chữ/nền < 4,5:1 (chữ lớn < 3:1), bỏ qua phần tử đang tắt (disabled).
 * Trả về danh sách lỗi (chuỗi tiếng Việt), rỗng = đạt.
 */
export function auditDom(): string[] {
  const vw = document.documentElement.clientWidth;
  const out: string[] = [];
  const name = (el: Element) => {
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${cls} “${t}”`;
  };
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden], details:not([open]) > :not(summary)');
  };
  // Vùng tự cuộn ngang (bảng, công thức) hoặc cắt (thanh tiến độ) — phần tử con vượt ra là chủ ý.
  const clipped = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') return true;
    }
    return false;
  };
  const isA11yHidden = (el: Element) => !!el.closest('.say-sr, [aria-hidden="true"]');

  const docOver = document.documentElement.scrollWidth - vw;
  if (docOver > 0) out.push(`trang cuộn ngang ${docOver}px`);

  const all = [...document.body.querySelectorAll('*')].filter(shown);
  for (const el of all) {
    if (isA11yHidden(el) && el.closest('.say-sr')) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 0.5 || r.left < -0.5) && !clipped(el)) out.push(`tràn mép: ${name(el)} [${Math.round(r.left)}…${Math.round(r.right)} / ${vw}]`);
    const cs = getComputedStyle(el);
    if (cs.display !== 'inline' && cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && !clipped(el)) {
      out.push(`chữ tràn hộp: ${name(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    }
  }

  // Vùng chạm.
  const TAP = 'button, a[href], summary, input:not([type="hidden"]):not([type="file"]), select, textarea, [role="button"], audio[controls]';
  for (const el of document.querySelectorAll(TAP)) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 43.5 || r.width < 43.5) out.push(`vùng chạm ${Math.round(r.width)}×${Math.round(r.height)} < 44: ${name(el)}`);
  }

  // Tương phản: đổi mọi màu CSS (kể cả color-mix, oklab) sang RGBA bằng canvas.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const rgba = (c: string): [number, number, number, number] => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
  };
  const over = (top: number[], bottom: number[]) => {
    const a = top[3]!;
    return [0, 1, 2].map((i) => top[i]! * a + bottom[i]! * (1 - a)).concat(1);
  };
  const bgOf = (el: Element): number[] => {
    const layers: number[][] = [];
    for (let p: Element | null = el; p; p = p.parentElement) {
      const c = rgba(getComputedStyle(p).backgroundColor);
      if (c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
    }
    let base = [255, 255, 255, 1];
    for (const l of layers.reverse()) base = over(l, base);
    return base;
  };
  const lum = (c: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
  };
  const seen = new Set<string>();
  for (const el of all) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
    if (!hasText || el.closest(':disabled, [aria-disabled="true"]')) continue;
    let op = 1;
    for (let p: Element | null = el; p; p = p.parentElement) op *= Number(getComputedStyle(p).opacity);
    const cs = getComputedStyle(el);
    const bg = bgOf(el);
    const fg = over([...rgba(cs.color).slice(0, 3), rgba(cs.color)[3] * op], bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x) as [number, number];
    const ratio = (a + 0.05) / (b + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const msg = `tương phản ${ratio.toFixed(2)} < ${need}: ${name(el)} (${cs.color} / nền ${bg.slice(0, 3).join(',')})`;
      if (!seen.has(msg)) out.push(msg);
      seen.add(msg);
    }
  }
  return out;
}

/** Ghi lại lỗi console và lỗi JS chưa bắt của trang. */
export function trackErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  return errs;
}

const TABS = { 'hom-nay': 'Hôm nay', 'tra-cuu': 'Tra cứu', 'tien-do': 'Tiến độ', 'cai-dat': 'Cài đặt' } as const;
export type TabId = keyof typeof TABS;

/**
 * Mở một tab như người dùng (bấm thanh tab). Không dùng page.goto('./#…') khi chỉ đổi hash:
 * trên WebKit đôi khi không phát `hashchange`, URL đổi mà trang vẫn ở tab cũ. Trang trắng thì tải bằng goto.
 */
export async function openTab(page: Page, id: TabId): Promise<void> {
  if (!page.url().startsWith('http')) await page.goto(`./#${id}`);
  else await page.getByRole('navigation', { name: 'Mục' }).getByRole('link', { name: TABS[id], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#${id}$`));
  await expect(page.getByRole('link', { name: TABS[id], exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}

/** Trang Hôm nay mở lại từ đầu (rời sang tab khác rồi quay lại để màn ôn đang mở được đóng). */
export async function freshHome(page: Page): Promise<void> {
  if (page.url().startsWith('http')) await openTab(page, 'tien-do');
  await openTab(page, 'hom-nay');
}

export async function audit(page: Page, where: string, found: string[]): Promise<void> {
  // Chờ hiệu ứng vào trang (0,18 s) xong để đo đúng vị trí và độ mờ.
  await page.waitForTimeout(220);
  // WebKit có thể chưa chạy xong hiệu ứng (độ mờ 0,6 → 1): chờ mọi animation kết thúc rồi mới đo.
  // Bỏ qua animation lặp vô hạn (chấm đỏ "đang ghi âm").
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const issues = await page.evaluate(auditDom);
  for (const i of issues) found.push(`[${where}] ${i}`);
}

/**
 * Đi hết các luồng chính của app như người dùng, gọi `at(tên màn)` ở mỗi màn.
 * Dùng chung cho test audit và chụp ảnh màn hình.
 */
export async function walkApp(page: Page, at: (where: string) => Promise<void>): Promise<void> {
  const btn = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
  const home = () => freshHome(page);

  await home();
  await at('hom-nay');

  // Phiên hằng ngày trộn TR + EN: màn đầu, rồi kết thúc → kết quả.
  await btn('Bắt đầu ôn hôm nay').click();
  await expect(page.getByTestId('mix-lane')).toBeVisible();
  await at('phien-ngay');
  await btn('Kết thúc').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await at('phien-ngay-ket-qua');

  // Phiên TR riêng theo từng cách ôn.
  const trMode = async (mode: string) => {
    await home();
    await btn('5 phút').click();
    await btn(mode).click();
    await page.getByRole('button', { name: /^Bắt đầu 5 phút/ }).click();
    await expect(page.locator('.card')).toBeVisible();
  };
  await trMode('Thẻ ghi nhớ');
  await at('tr-the');
  await btn('Lật thẻ').click();
  await at('tr-the-lat');
  await btn(/^Quên/).click();
  await btn('Kết thúc').click();
  await at('tr-ket-qua');

  await trMode('Trắc nghiệm');
  await at('tr-trac-nghiem');
  await page.locator('.opt').first().click();
  await expect(btn('Câu tiếp')).toBeVisible();
  await at('tr-trac-nghiem-dap-an');

  await trMode('Bài tính');
  await at('tr-bai-tinh');
  await page.getByRole('textbox', { name: 'Đáp số' }).fill('1.530');
  await btn('Kiểm tra').click();
  await at('tr-bai-tinh-dap-an');

  await trMode('Câu hỏi mở');
  await btn('Xem gợi ý & tự chấm').click();
  await at('tr-cau-mo');

  await trMode('Thuật ngữ Anh – Việt');
  await btn('Xem nghĩa').click();
  await at('tr-thuat-ngu');

  // Tiếng Anh: thẻ từ, câu mẫu, shadowing, luyện nói, đề nói.
  await home();
  await page.getByRole('button', { name: /^Thẻ từ/ }).click();
  await at('en-the-tu');
  await btn('Lật thẻ').click();
  await at('en-the-tu-lat');
  await btn(/^Nhớ rõ/).click();
  await btn('Kết thúc').click();
  await at('en-ket-qua');

  await home();
  await page.getByRole('button', { name: /^Câu mẫu/ }).click();
  await at('en-cau-mau');
  await btn('Đã nhại · sang tự thay từ').click();
  await page.locator('.en-slots .chip').nth(1).click();
  await at('en-cau-mau-thay-tu');

  await home();
  await page.getByRole('button', { name: /^Shadowing/ }).click();
  await at('en-shadowing');
  await page.getByRole('button', { name: /Họp · phần 1/ }).click();
  await at('en-shadowing-bai');

  await home();
  await page.getByRole('button', { name: /^Luyện nói/ }).click();
  await expect(page.getByTestId('say-target')).toBeVisible();
  const target = (await page.getByTestId('say-target').textContent()) ?? '';
  await page.evaluate((s) => ((window as unknown as { __nextSay: string }).__nextSay = s), target.split(' ').slice(0, 3).join(' '));
  await btn('Nói thử').click();
  await expect(page.getByTestId('say-score')).toBeVisible();
  await at('en-luyen-noi');
  await btn('Kết thúc').click();
  await at('en-luyen-noi-ket-qua');

  await home();
  await page.getByRole('button', { name: /^Đề nói 1 phút/ }).click();
  await at('en-de-noi');
  await page.locator('.sh-tracks .opt').first().click();
  await btn('30 giây').click();
  await btn('Bắt đầu ghi âm').click();
  await expect(page.getByTestId('rec-status')).toContainText('Đang ghi âm');
  await at('en-de-noi-ghi-am');
  await btn('Dừng & lưu').click();
  await expect(page.getByTestId('rec-item')).toHaveCount(1);
  await at('en-de-noi-ban-ghi');

  // Tra cứu: mở một mục TR và một cụm EN.
  await openTab(page, 'tra-cuu');
  await at('tra-cuu');
  await page.getByRole('searchbox').fill('compa');
  await page.locator('details.item summary').first().click();
  await at('tra-cuu-tr');
  await page.getByRole('searchbox').fill('touch base');
  await page.locator('details.item summary').first().click();
  await at('tra-cuu-en');
  await page.getByRole('searchbox').fill('zzzzqqq');
  await expect(page.getByText('Không có mục nào khớp', { exact: false })).toBeVisible();
  await at('tra-cuu-rong');

  await openTab(page, 'tien-do');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await at('tien-do');

  await openTab(page, 'cai-dat');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await at('cai-dat');
  await btn('Dán JSON').click();
  await page.getByRole('textbox', { name: 'Nội dung JSON' }).fill('{"srs":{"K001":{"b":3,"d":"2026-11-01","w":1}},"days":{},"notes":{}}');
  await btn('Đọc dữ liệu').click();
  await expect(btn('Gộp')).toBeVisible();
  await at('cai-dat-nhap');
  await btn('Hủy').click();
  await btn('Dán JSON').click();
  await page.getByRole('textbox', { name: 'Nội dung JSON' }).fill('không phải json');
  await btn('Đọc dữ liệu').click();
  await expect(page.getByTestId('backup-status')).toBeVisible();
  await at('cai-dat-loi');
}
