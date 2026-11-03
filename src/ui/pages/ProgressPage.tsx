import { Placeholder } from '../components/Placeholder';

export function ProgressPage() {
  return (
    <section className="stack" aria-labelledby="h-progress">
      <div className="panel stack">
        <h1 id="h-progress" className="h-page">
          Tiến độ
        </h1>
        <div className="stats">
          <div className="stat">
            <b className="num">0</b>
            <span>ngày liên tiếp</span>
          </div>
          <div className="stat">
            <b className="num">0</b>
            <span>mục đã thuộc</span>
          </div>
          <div className="stat">
            <b className="num">0</b>
            <span>lượt ôn</span>
          </div>
        </div>
        <Placeholder session="S3">
          Tiến độ theo buổi học, bản đồ nhiệt các ngày ôn, ghi chú, xuất/nhập tiến độ.
        </Placeholder>
      </div>
    </section>
  );
}
