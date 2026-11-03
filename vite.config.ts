/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// base './' để chạy được ở thư mục con hoặc mở bản build cục bộ.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // tự đăng ký trong src/main.tsx
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
