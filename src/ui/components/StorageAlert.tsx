import type { StorageProblem } from '../../core/progress';
import { useProgress } from '../useProgress';

const STORAGE_PROBLEM_VI: Record<StorageProblem, string> = {
  unavailable:
    'Không mở được bộ nhớ trên máy (IndexedDB), nên tiến độ lần này sẽ không được lưu. Nếu đang dùng Duyệt web riêng tư, hãy mở bằng tab thường hoặc app ở Màn hình chính.',
  quota:
    'Bộ nhớ máy đã đầy, không lưu được tiến độ mới. Xóa bớt bản ghi âm (Hôm nay → Đề nói 1 phút) hoặc giải phóng dung lượng iPhone, rồi vào Cài đặt → Xuất tiến độ để sao lưu.',
  write: 'Không lưu được tiến độ vào bộ nhớ máy. Kết quả vẫn còn trong lần mở này; vào Cài đặt → Xuất tiến độ để không mất dữ liệu.',
};

/** Thông báo khi IndexedDB không dùng được / bộ nhớ đầy (trước đây lỗi bị bỏ qua, người dùng mất tiến độ mà không biết). */
export function StorageAlert() {
  const p = useProgress();
  if (!p.problem) return null;
  return (
    <div className="status err storage-alert" role="alert" data-testid="storage-alert">
      <span>{STORAGE_PROBLEM_VI[p.problem]}</span>
      <button type="button" className="btn ghost small" onClick={() => p.dismissProblem()}>
        Đã hiểu
      </button>
    </div>
  );
}
