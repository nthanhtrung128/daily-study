import { useEffect, useSyncExternalStore } from 'react';
import { progress, type Progress } from '../core/progress';

/** Đăng ký nhận thay đổi tiến độ; tự tải từ IndexedDB lần đầu. */
export function useProgress(p: Progress = progress): Progress {
  useSyncExternalStore(p.subscribe, p.getVersion, p.getVersion);
  useEffect(() => {
    if (!p.loaded) void p.load();
  }, [p]);
  return p;
}
