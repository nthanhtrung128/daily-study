/**
 * Lưu trữ bền vững (StorageManager): xin trình duyệt không tự xóa IndexedDB khi máy thiếu dung lượng
 * hoặc lâu không mở. Trên iOS, Safari (mở bằng trình duyệt) vẫn có thể xóa dữ liệu web; app ở Màn hình chính an toàn hơn.
 * Mọi hàm an toàn khi API không có: trả về null, không ném lỗi.
 */
type Sm = Partial<Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>>;

const sm = (nav: { storage?: Sm } | undefined): Sm | undefined => {
  try {
    return nav?.storage;
  } catch {
    return undefined;
  }
};

const defaultNav = () => (typeof navigator === 'undefined' ? undefined : (navigator as { storage?: Sm }));

/** Đã bật lưu trữ bền vững chưa (null = trình duyệt không hỗ trợ). */
export async function isPersisted(nav = defaultNav()): Promise<boolean | null> {
  const s = sm(nav);
  if (typeof s?.persisted !== 'function') return null;
  try {
    return await s.persisted();
  } catch {
    return null;
  }
}

/** Xin bật lưu trữ bền vững nếu có API và chưa bật. Trả về trạng thái sau khi xin (null = không hỗ trợ). */
export async function requestPersist(nav = defaultNav()): Promise<boolean | null> {
  const s = sm(nav);
  if (typeof s?.persist !== 'function') return null;
  try {
    if (typeof s.persisted === 'function' && (await s.persisted())) return true;
    return await s.persist();
  } catch {
    return null;
  }
}

/** Dung lượng đang dùng (byte), null nếu không đọc được. */
export async function storageUsage(nav = defaultNav()): Promise<number | null> {
  const s = sm(nav);
  if (typeof s?.estimate !== 'function') return null;
  try {
    const e = await s.estimate();
    return typeof e.usage === 'number' && Number.isFinite(e.usage) ? e.usage : null;
  } catch {
    return null;
  }
}

/** Xin một lần mỗi lần mở app (gọi sau lượt chấm đầu tiên). */
let asked = false;
export function requestPersistOnce(nav = defaultNav()): void {
  if (asked) return;
  asked = true;
  void requestPersist(nav);
}
export const resetPersistAskForTest = () => {
  asked = false;
};
