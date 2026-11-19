import { expect, test as base } from '@playwright/test';
import { createServer, get } from 'node:http';
import type { AddressInfo } from 'node:net';
import { audit } from './helpers/audit';

// WebKit cần phản hồi HTTP 302 thực. Máy chủ thử nghiệm chỉ lắng nghe trên loopback.
const test = base.extend<{ access: { origin: string; checks: () => number } }>({
  access: async ({ baseURL }, provideAccess) => {
    if (!baseURL) throw new Error('Thiếu URL bản preview.');
    let checks = 0;
    const server = createServer((req, res) => {
      if (req.url === '/cdn-cgi/access/get-identity') {
        checks++;
        if (checks === 1) {
          res.writeHead(200, { 'content-type': 'text/html' }).end('<p>Trang dự phòng</p>');
          return;
        }
        if (checks === 2) {
          res.writeHead(302, { location: '/dang-nhap' }).end();
          return;
        }
        const missing = checks === 3;
        res.writeHead(missing ? 400 : 200, { 'content-type': 'application/json' })
          .end(JSON.stringify(missing ? { err: 'no app token set' } : { email: 'nguoi-hoc-voi-dia-chi-dai@example.test' }));
        return;
      }
      if (req.url === '/cdn-cgi/access/logout') {
        res.writeHead(200, { 'content-type': 'text/html' }).end('Trang đăng xuất thử nghiệm');
        return;
      }
      const upstream = get(baseURL, { path: req.url ?? '/' }, (reply) => {
        res.writeHead(reply.statusCode ?? 502, reply.headers);
        reply.pipe(res);
      });
      upstream.on('error', () => res.writeHead(502).end());
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { port } = server.address() as AddressInfo;
      await provideAccess({ origin: `http://127.0.0.1:${port}`, checks: () => checks });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
});

test('chỉ kiểm tra phiên theo yêu cầu, xác nhận email và mở đúng đường đăng xuất', async ({ page, access }) => {
  await page.goto(access.origin + '/#cai-dat');
  const account = page.getByRole('region', { name: 'Tài khoản' });
  const check = account.getByRole('button', { name: 'Kiểm tra phiên' });
  await expect(account.getByRole('link', { name: 'Đăng nhập qua Cloudflare' })).toBeVisible();
  expect(access.checks()).toBe(0);
  await check.click();
  await expect(account.getByRole('status')).toContainText('Chưa kiểm tra được phiên');
  await check.click();
  await expect(account.getByRole('status')).toContainText('Cần đăng nhập qua Cloudflare');
  await check.click();
  await expect(check).toBeEnabled();
  await expect(account.getByRole('status')).toContainText('Cần đăng nhập qua Cloudflare');
  await check.click();
  await expect(account.getByRole('status')).toContainText('nguoi-hoc-voi-dia-chi-dai@example.test');
  const findings: string[] = [];
  await audit(page, 'tai-khoan', findings);
  expect(findings).toEqual([]);
  const logout = account.getByRole('link', { name: 'Đăng xuất Cloudflare' });
  await expect(logout).toHaveAttribute('href', '/cdn-cgi/access/logout');
  await logout.click();
  await expect(page).toHaveURL(/\/cdn-cgi\/access\/logout$/);
  expect(access.checks()).toBe(4);
});

test('đăng nhập qua mạng, quay về Cài đặt và tải lại ngoại tuyến cùng memo', async ({ page, context }) => {
  await page.goto('./#lo-trinh?bai=trm-05-02');
  await page.getByRole('textbox', { name: 'Memo của bài' }).fill('Đối chiếu sau khi đăng nhập');
  await page.getByText('Đã lưu trên máy.').waitFor();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  const account = page.getByRole('region', { name: 'Tài khoản' });
  const login = account.getByRole('link', { name: 'Đăng nhập qua Cloudflare' });
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === '/dang-nhap'),
    login.click(),
  ]);
  expect(response.fromServiceWorker()).toBe(false);
  await expect(page).toHaveURL(/\/#cai-dat\?muc=tai-khoan$/);
  await expect(account.getByRole('heading')).toBeFocused();
  await context.setOffline(true);
  await page.reload();
  await expect(account.getByRole('status')).toContainText('ngoại tuyến');
  await expect(login).toHaveCount(0);
  await expect(account.getByRole('button')).toBeDisabled();
  await context.setOffline(false);
  await expect(login).toBeVisible();
  await page.goto('./#lo-trinh?bai=trm-05-02');
  await expect(page.getByRole('textbox', { name: 'Memo của bài' })).toHaveValue('Đối chiếu sau khi đăng nhập');
});
