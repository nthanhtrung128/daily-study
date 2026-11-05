import { useInSession } from '../activeSession';
import './backup.css';
import { applyUpdate, dismissUpdate, shouldShowUpdate, useSwUpdate } from '../swUpdate';

/** Dải "Có bản mới — Cập nhật". Không hiện khi đang trong một phiên ôn (đợi tới màn kết quả / trang khác). */
export function UpdateBar() {
  const { need, dismissed } = useSwUpdate();
  const inSession = useInSession();
  if (!shouldShowUpdate(need, dismissed, inSession)) return null;
  return (
    <div className="backup-nudge update-bar" role="region" aria-label="Bản mới" data-testid="update-bar">
      <p className="nudge-text">
        <b>Có bản mới.</b> Cập nhật để dùng bản mới nhất; tiến độ không bị ảnh hưởng.
      </p>
      <div className="row">
        <button type="button" className="btn small" onClick={applyUpdate}>
          Cập nhật
        </button>
        <button type="button" className="btn ghost small" onClick={dismissUpdate}>
          Để sau
        </button>
      </div>
    </div>
  );
}
