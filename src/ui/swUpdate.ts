import { useSyncExternalStore } from 'react';

/**
 * Cập nhật bản mới kiểu "hỏi trước" (vite-plugin-pwa registerType: 'prompt'):
 * main.tsx gọi `setUpdater` khi có bản mới đang chờ; dải "Có bản mới" và Cài đặt đọc trạng thái ở đây.
 */
interface State {
  need: boolean;
  dismissed: boolean;
}
let state: State = { need: false, dismissed: false };
let updater: ((reload?: boolean) => Promise<void>) | null = null;
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};

/** Hiện dải khi có bản mới, chưa bấm "Để sau" trong lần mở này, và không đang trong phiên ôn. */
export function shouldShowUpdate(need: boolean, dismissed: boolean, inSession: boolean): boolean {
  return need && !dismissed && !inSession;
}

export function setUpdater(fn: (reload?: boolean) => Promise<void>) {
  updater = fn;
}

export function markNeedRefresh() {
  set({ need: true });
}

/** "Để sau": ẩn tới lần mở app sau (chỉ trong bộ nhớ). */
export function dismissUpdate() {
  set({ dismissed: true });
}

export function applyUpdate() {
  if (updater) void updater(true);
  else window.location.reload();
}

export function useSwUpdate(): State {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}
