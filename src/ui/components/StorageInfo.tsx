import { useEffect, useState } from 'react';
import { requestPersist, storageUsage } from '../../core/persist';
import { fmtSize } from '../../modules/english/speech/recordings';

/**
 * Trạng thái lưu trữ bền vững + dung lượng đang dùng (khối Dữ liệu ở Cài đặt).
 * Mở Cài đặt cũng xin bật lưu trữ bền vững. Trình duyệt không có API thì ẩn dòng tương ứng.
 */
export function StorageInfo() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    void requestPersist().then((v) => live && setPersisted(v));
    void storageUsage().then((v) => live && setUsage(v));
    return () => {
      live = false;
    };
  }, []);

  if (persisted === null && usage === null) return null;
  return (
    <div className="stack storage-info" data-testid="storage-info">
      {persisted !== null && (
        <p className="hint" style={{ margin: 0 }} data-testid="storage-persist">
          Lưu trữ bền vững: <b>{persisted ? 'đã bật' : 'chưa bật'}</b>
          {persisted ? '.' : ' — Thêm vào Màn hình chính để iOS không tự xóa dữ liệu.'}
        </p>
      )}
      {usage !== null && (
        <p className="hint" style={{ margin: 0 }} data-testid="storage-usage">
          Dung lượng đang dùng: {fmtSize(usage)}
        </p>
      )}
    </div>
  );
}
