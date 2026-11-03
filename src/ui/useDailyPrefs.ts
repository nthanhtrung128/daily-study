import { useEffect, useSyncExternalStore } from 'react';
import { getSetting, setSetting } from '../core/db';
import { DAILY_KEY, DEFAULT_DAILY, normalizePrefs, type DailyPrefs } from '../core/prefs';

/** Cài đặt phiên hằng ngày dùng chung giữa trang Hôm nay và Cài đặt (đọc một lần từ IndexedDB). */
let prefs: DailyPrefs = DEFAULT_DAILY;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const get = () => prefs;

function load() {
  if (loaded) return;
  loaded = true;
  void getSetting<unknown>(DAILY_KEY, null)
    .then((v) => {
      if (v !== null) {
        prefs = normalizePrefs(v);
        emit();
      }
    })
    .catch(() => undefined);
}

export function setDailyPrefs(patch: Partial<DailyPrefs>): void {
  prefs = normalizePrefs({ ...prefs, ...patch });
  emit();
  void setSetting(DAILY_KEY, prefs).catch(() => undefined);
}

/** Đọc lại sau khi nhập bản sao lưu (cài đặt có thể đã đổi). */
export function reloadDailyPrefs(): void {
  loaded = false;
  load();
}

export function useDailyPrefs(): DailyPrefs {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, get, get);
}
