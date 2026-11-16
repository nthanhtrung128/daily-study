import { useEffect, useSyncExternalStore } from 'react';
import { progress } from '../core/progress';
import { advance, clearActive, saveActive, type ActiveKind, type ActiveSession, type SavedItem, type SavedResult } from '../core/resume';

/**
 * Theo dõi phiên đang chạy: lưu vị trí vào Dexie (để tiếp tục khi iOS tắt app) và báo "đang trong phiên"
 * cho dải cập nhật bản mới (không hiện giữa phiên). Ghi IndexedDB theo thứ tự gọi; lỗi ghi bỏ qua.
 */
let cur: ActiveSession | null = null;
let mounted = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const persist = () => void (cur ? saveActive(cur) : clearActive()).catch(() => undefined);

export function beginSession(kind: ActiveKind, items: SavedItem[], t0: number, minutes: number, pos = 0, results: SavedResult[] = []) {
  cur = { kind, items, pos, results, t0, minutes, savedAt: Date.now() };
  // Mốc đo thời gian học: lượt chấm đầu tiên của phiên tính từ lúc mở phiên.
  progress.touch();
  persist();
}

/** Sau mỗi lượt chấm / chuyển câu: `pos` = chỉ số mục tiếp theo. */
export function stepSession(pos: number, result?: SavedResult) {
  if (!cur) return;
  cur = advance(cur, pos, Date.now(), result);
  persist();
}

export function endSession() {
  cur = null;
  persist();
}

/** Màn phiên đang mở (dùng để hoãn dải cập nhật). */
export function useInSessionMark(active = true) {
  useEffect(() => {
    if (!active) return;
    mounted++;
    emit();
    return () => {
      mounted--;
      emit();
    };
  }, [active]);
}

export function isInSession() {
  return mounted > 0;
}

export function useInSession(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    isInSession,
  );
}
