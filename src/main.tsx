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

applyTheme(loadTheme());
applyFontSize(loadFontSize());

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

const root = document.getElementById('root');
if (!root) throw new Error('Thiếu #root trong index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
