import { useEffect, useSyncExternalStore } from 'react';
import { getSetting, setSetting } from '../core/db';
import {
  DEFAULT_REMINDER,
  EVERY_KEY,
  LAST_KEY,
  SNOOZE_KEY,
  normalizeReminder,
  snoozeUntil,
  type ReminderState,
  type RemindEvery,
} from '../core/backupReminder';

/** Trạng thái nhắc sao lưu dùng chung giữa trang Hôm nay và Cài đặt (đọc một lần từ IndexedDB). */
let state: ReminderState = DEFAULT_REMINDER;
let loaded = false;
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const get = () => state;
const set = (patch: Partial<ReminderState>) => {
  state = { ...state, ...patch };
  emit();
};

function load() {
  if (loaded) return;
  loaded = true;
  void Promise.all([getSetting<unknown>(LAST_KEY, null), getSetting<unknown>(SNOOZE_KEY, 0), getSetting<unknown>(EVERY_KEY, undefined)])
    .then(([lastAt, snooze, every]) => {
      state = normalizeReminder({ lastAt, snoozeUntil: snooze, every });
      ready = true;
      emit();
    })
    .catch(() => undefined);
}

/** Đã đọc xong từ IndexedDB (trước đó không hiện nhắc để khỏi nháy). */
export const reminderReady = () => ready;

/** Ghi nhận vừa xuất sao lưu xong. */
export function markBackedUp(at = Date.now()): void {
  set({ lastAt: at, snoozeUntil: 0 });
  void Promise.all([setSetting(LAST_KEY, at), setSetting(SNOOZE_KEY, 0)]).catch(() => undefined);
}

/** "Để sau": ẩn nhắc 3 ngày. */
export async function snoozeReminder(now = Date.now()): Promise<void> {
  const until = snoozeUntil(now);
  await setSetting(SNOOZE_KEY, until);
  set({ snoozeUntil: until });
}

export function setRemindEvery(every: RemindEvery): void {
  set({ every });
  void setSetting(EVERY_KEY, every).catch(() => undefined);
}

/** Đọc lại sau khi nhập bản sao lưu (chu kỳ nhắc có thể đã đổi). */
export function reloadReminder(): void {
  loaded = false;
  load();
}

/** Chỉ dùng trong test. */
export function resetReminderForTest(): void {
  state = DEFAULT_REMINDER;
  loaded = false;
  ready = false;
}

export function useBackupReminder(): ReminderState {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, get, get);
}

/** Bấm "Sao lưu ngay" ở trang Hôm nay → trang Cài đặt cuộn tới phần sao lưu. */
let focusBackup = false;
export const requestBackupFocus = () => {
  focusBackup = true;
};
export const takeBackupFocus = () => {
  const v = focusBackup;
  focusBackup = false;
  return v;
};
