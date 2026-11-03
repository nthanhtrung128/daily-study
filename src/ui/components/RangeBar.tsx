import { clamp01 } from '../../core/num';

/** Thanh dải lương Min – Mid – Max: motif chính để thể hiện mức thuộc bài (0 → 1). */
interface Props {
  /** Vị trí trong dải, 0–1. */
  value: number;
  label?: string;
}

export function RangeBar({ value, label = 'Mức thuộc bài – vị trí trong dải' }: Props) {
  const pct = `${(clamp01(value) * 100).toFixed(1)}%`;
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div
        className="range"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamp01(value) * 100)}
      >
        <div className="track">
          <div className="fill" style={{ width: pct }} />
        </div>
        <i className="tick" style={{ left: '50%' }} />
        <i className="mark" style={{ left: pct }} />
      </div>
      <div className="range-lbl" aria-hidden="true">
        <span>
          Min<span className="desc"> · mới học</span>
        </span>
        <span>
          Mid<span className="desc"> · nắm cơ bản</span>
        </span>
        <span>
          Max<span className="desc"> · thành thạo</span>
        </span>
      </div>
    </div>
  );
}
