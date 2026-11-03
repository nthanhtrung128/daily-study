import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * WebKit (engine của Safari) chỉ chạy khi đặt PW_WEBKIT=1, vì cần `npx playwright install --with-deps webkit`
 * (CI có cài; container không có mạng tới CDN Playwright thì bỏ qua). Chromium luôn chạy.
 */
const WEBKIT = process.env.PW_WEBKIT === '1';
const chromiumLaunch = process.env.PW_CHROMIUM_PATH
  ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
  : {};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    // Chromium giả lập kích thước, DPR, touch, UA của iPhone.
    { name: 'iPhone 14', use: { ...devices['iPhone 14'], browserName: 'chromium', ...chromiumLaunch } },
    { name: 'iPhone SE', use: { ...devices['iPhone SE'], browserName: 'chromium', ...chromiumLaunch } },
    ...(WEBKIT
      ? [
          { name: 'iPhone 14 WebKit', use: { ...devices['iPhone 14'], browserName: 'webkit' as const } },
          { name: 'iPhone SE WebKit', use: { ...devices['iPhone SE'], browserName: 'webkit' as const } },
        ]
      : []),
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
