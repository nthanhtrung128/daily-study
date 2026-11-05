/** Khối "Bạn đang ôn dở (12/30) — Tiếp tục / Bỏ phiên" trên trang Hôm nay. */
export function ResumePanel({ done, total, onResume, onDrop }: { done: number; total: number; onResume: () => void; onDrop: () => void }) {
  return (
    <div className="panel stack" role="region" aria-labelledby="h-resume" data-testid="resume-panel">
      <p id="h-resume" style={{ margin: 0 }}>
        <b>
          Bạn đang ôn dở (<span className="num">{`${done}/${total}`}</span>)
        </b>
        <br />
        <span className="hint">Các mục đã chấm đã được lưu. Tiếp tục từ câu tiếp theo hoặc bỏ phiên này.</span>
      </p>
      <div className="row">
        <button type="button" className="btn" onClick={onResume}>
          Tiếp tục
        </button>
        <button type="button" className="btn ghost" onClick={onDrop}>
          Bỏ phiên
        </button>
      </div>
    </div>
  );
}
