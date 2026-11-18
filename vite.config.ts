/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { headersForPath, parseHeadersFile } from './scripts/cf-headers';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** `vite preview` trả đúng header trong public/_headers (như Cloudflare Pages) để test được CSP, cache. */
function cloudflareHeadersPreview(): Plugin {
  return {
    name: 'cloudflare-headers-preview',
    configurePreviewServer(server) {
      const rules = parseHeadersFile(readFileSync(new URL('./public/_headers', import.meta.url), 'utf8'));
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split('?')[0] ?? '/';
        for (const [k, v] of Object.entries(headersForPath(rules, path))) res.setHeader(k, v);
        next();
      });
    },
  };
}

// base './' để chạy được ở thư mục con hoặc mở bản build cục bộ.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    rollupOptions: {
      output: {
        // Tách bundle 870 kB thành các phần tải song song (modulepreload) và cache riêng:
        // nội dung JSON (TR101 + tiếng Anh, ít đổi) và thư viện (React, Dexie) không phải tải lại khi chỉ sửa code app.
        // Không dùng dynamic import cho content: trang Hôm nay cần toàn bộ nội dung ngay để lập phiên và thống kê.
        manualChunks(id) {
          if (id.includes('/content/tr-roadmap/')) return 'tr-roadmap';
          if (id.includes('/content/')) return 'content';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('node_modules/dexie')) return 'dexie';
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    cloudflareHeadersPreview(),
    VitePWA({
      registerType: 'prompt', // hỏi trước khi cập nhật, không tự tải lại giữa phiên ôn
      injectRegister: false, // tự đăng ký trong src/main.tsx
      // <link rel="manifest" crossorigin="use-credentials">: sau Cloudflare Access, tải manifest cần cookie.
      useCredentials: true,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        id: './',
        name: 'Ôn luyện mỗi ngày – Total Rewards & tiếng Anh',
        short_name: 'Ôn mỗi ngày',
        description: 'Ôn Total Rewards (TR101) và luyện nói tiếng Anh công sở mỗi ngày. Chạy offline, dữ liệu lưu trên máy.',
        lang: 'vi',
        dir: 'ltr',
        start_url: './#hom-nay',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EEF1F4',
        theme_color: '#EEF1F4',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: 'index.html',
        // Các đường dẫn này luôn đi ra mạng (không trả index.html từ cache) để Cloudflare Access chặn và cho
        // đăng nhập lại: /cdn-cgi/ (đăng nhập/đăng xuất của Access) và /dang-nhap (trang mở app qua mạng, xem docs/DEPLOY.md).
        navigateFallbackDenylist: [/^\/cdn-cgi\//, /^\/dang-nhap/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
