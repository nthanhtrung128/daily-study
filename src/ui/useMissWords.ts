import { useEffect, useSyncExternalStore } from 'react';
import { missStore, type MissMap } from '../core/misswords';

/** Bản đồ "từ hay sai" (tự đọc từ IndexedDB lần đầu). */
export function useMissWords(): MissMap {
  const map = useSyncExternalStore(missStore.subscribe, missStore.get, missStore.get);
  useEffect(() => {
    if (!missStore.loaded) void missStore.load();
  }, []);
  return map;
}
