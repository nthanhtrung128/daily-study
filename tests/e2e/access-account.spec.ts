import { expect, test } from '@playwright/test';
import { audit } from './helpers/audit';

test('chỉ kiểm tra phiên theo yêu cầu, xác nhận email và mở đúng đường đăng xuất', async ({ page }) => {
  let checks = 0;
  await page.route('**/cdn-cgi/access/get-identity', async (route) => {
    checks++;
    if (checks === 1) return route.fulfill({ contentType: 'text/html', body: '<p>Trang dự phòng</p>' });
    if (checks === 2) return route.fulfill({ status: 302, headers: { location: '/dang-nhap' } });
    if (checks === 3) return route.fulfill({ status: 400, json: { err: 'no app token set' } });
    return route.fulfill({ json: { email: 'nguoi-hoc-voi-dia-chi-dai@example.test' } });
  });
  await page.goto('./#cai-dat');
  const account = page.getByRole('region', { name: 'Tài khoản' });
  const check = account.getByRole('button', { name: 'Kiểm tra phiên' });
  await expect(account.getByRole('link', { name: 'Đăng nhập qua Cloudflare' })).toBeVisible();
  expect(checks).toBe(0);
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
  await page.route('**/cdn-cgi/access/logout', (route) => route.fulfill({ contentType: 'text/html', body: 'Trang đăng xuất thử nghiệm' }));
  await logout.click();
  await expect(page).toHaveURL(/\/cdn-cgi\/access\/logout$/);
  expect(checks).toBe(4);
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
