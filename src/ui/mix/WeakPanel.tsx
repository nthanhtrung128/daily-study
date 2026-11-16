import { useMemo } from 'react';
import { planWeak } from '../../modules/mix/weak';
import type { DailyEntry } from '../../modules/mix/plan';
import { speechRec } from '../../modules/english/speech/recognizer';
import { useMissWords } from '../useMissWords';
import { useProgress } from '../useProgress';
import './mix.css';

/** Khối "Ôn điểm yếu" trên trang Hôm nay: mục TR / EN hay sai hoặc vừa quên + câu chứa từ hay nói / nghe sai. */
export function WeakPanel({ onStart }: { onStart: (entries: DailyEntry[]) => void }) {
  const p = useProgress();
  const miss = useMissWords();
  const v = p.getVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => planWeak(p.stateOf, p.nowMs(), miss, { canSpeak: speechRec.supported }), [p, v, miss]);
  const tr = entries.filter((e) => e.lane === 'tr').length;
  const sent = entries.filter((e) => e.tier === 'extra').length;
  const en = entries.length - tr - sent;

  return (
    <div className="panel stack" role="region" aria-labelledby="h-weak" data-testid="weak-panel">
      <div>
        <div className="eyebrow">Lỗi hay gặp</div>
        <h2 id="h-weak" className="h-page">
          Ôn điểm yếu
        </h2>
      </div>
      {entries.length ? (
        <>
          <div className="daily-sum" data-testid="weak-sum">
            {tr > 0 && <span className="tag" data-lane="tr">{`${tr} mục TR`}</span>}
            {en > 0 && <span className="tag" data-lane="en">{`${en} mục tiếng Anh`}</span>}
            {sent > 0 && <span className="tag" data-lane="speak">{`${sent} câu có từ hay sai`}</span>}
          </div>
          <button type="button" className="btn daily-go" onClick={() => onStart(entries)}>
            {`Ôn điểm yếu (${entries.length} mục)`}
          </button>
          <p className="hint">Mục sai nhiều hoặc vừa quên lên trước; câu có từ bạn hay nói / nghe sai để luyện lại. Chấm đúng thì mục rời danh sách.</p>
        </>
      ) : (
        <p className="hint" data-testid="weak-empty">
          Chưa có điểm yếu nào — tốt lắm! Khi bạn chấm Quên / Sai, hoặc nói, nghe chép sai từ, các mục đó sẽ gom về đây để ôn lại.
        </p>
      )}
    </div>
  );
}
