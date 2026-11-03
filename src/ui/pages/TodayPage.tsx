import { RangeBar } from '../components/RangeBar';
import { Placeholder } from '../components/Placeholder';

export function TodayPage() {
  return (
    <section className="stack" aria-labelledby="h-today">
      <div className="panel stack">
        <RangeBar value={0} />
        <div className="stats">
          <div className="stat">
            <b className="num">0</b>
            <span>đến hạn ôn hôm nay</span>
          </div>
          <div className="stat">
            <b className="num">0</b>
            <span>câu từng làm sai</span>
          </div>
          <div className="stat">
            <b className="num">0</b>
            <span>mục đã ôn hôm nay</span>
          </div>
        </div>
      </div>

      <div className="panel stack">
        <h1 id="h-today" className="h-page">
          Hôm nay ôn bao lâu?
        </h1>
        <p className="muted">
          Mỗi phiên trộn <b>Total Rewards 40%</b> và <b>tiếng Anh giao tiếp 60%</b>.
        </p>
        <Placeholder session="S2 · S8">
          Phiên ôn hằng ngày (thẻ, trắc nghiệm, bài tính, câu mẫu, shadowing) sẽ có ở các phiên tiếp theo.
        </Placeholder>
        <div className="row">
          <button type="button" className="btn" disabled>
            Bắt đầu ôn
          </button>
        </div>
      </div>
    </section>
  );
}
