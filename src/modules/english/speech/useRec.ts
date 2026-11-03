import { useEffect, useSyncExternalStore } from 'react';
import { speechRec, type RecState } from './recognizer';

/** Trạng thái nhận giọng dùng chung (một lượt nghe tại một thời điểm). */
export function useRecState(): RecState {
  return useSyncExternalStore(speechRec.subscribe, speechRec.getState, speechRec.getState);
}

/** Hủy nhận giọng khi rời trang / ẩn app và khi màn hình unmount. */
export function useRecLifecycle(): void {
  useEffect(() => {
    const off = speechRec.bindPageLifecycle();
    return () => {
      off();
      speechRec.abort();
    };
  }, []);
}
