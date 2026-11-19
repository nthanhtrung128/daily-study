import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import '@fontsource/source-serif-4/latin-400.css';
import '@fontsource/source-serif-4/vietnamese-400.css';
import '@fontsource/source-serif-4/latin-600.css';
import '@fontsource/source-serif-4/vietnamese-600.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/vietnamese-500.css';
import './ui/styles.css';

import { App } from './App';
import { applyTheme, loadTheme } from './core/theme';
import { applyFontSize, loadFontSize } from './core/fontsize';
import { markNeedRefresh, setUpdater } from './ui/swUpdate';

// Sau khi Access trả về app, quay về URL nằm trong bộ nhớ đệm để lần tải lại ngoại tuyến vẫn mở được.
if (location.pathname === '/dang-nhap' && new URLSearchParams(location.search).get('ve') === 'tai-khoan') {
  history.replaceState(null, '', '/#cai-dat?muc=tai-khoan');
}

applyTheme(loadTheme());
applyFontSize(loadFontSize());

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Bản mới tải xong thì chờ; dải "Có bản mới" hỏi người dùng (updateSW(true) = kích hoạt + tải lại).
  setUpdater(registerSW({ immediate: true, onNeedRefresh: markNeedRefresh }));
}

const root = document.getElementById('root');
if (!root) throw new Error('Thiếu #root trong index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
