import { useEffect, useRef, useState } from 'react';
import type { Grade } from '../../../core/leitner';
import { fmt } from '../../../core/num';
import { useProgress } from '../../../ui/useProgress';
import { GradeRow } from '../../tr/cards/TrCard';
import { speechRec } from '../speech/recognizer';
import { SAY_SOURCE_VI, type SayItem } from '../speech/sayItems';
import { GRADE_VI, gradeForScore } from '../speech/score';
import { useRecLifecycle } from '../speech/useRec';
import { SayCheck } from './SayCheck';
import { SpeakButton } from './SpeakButton';
import { useFocusOnMount } from '../../../ui/useFocusOnMount';
import '../speech.css';

interface Done {
  it: SayItem;
  score: number | null;
  g: Grade;
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Luyện nói có chấm: lần lượt từng câu (câu mẫu / ví dụ / hội thoại) → nói → so từng từ → điểm.
 * Bấm "Tiếp" thì chấm Leitner theo điểm cao nhất của các lần thử (≥90 Nhớ rõ, 60–89 Mơ hồ, <60 Quên).
 */
export function SpeakScreen({ list, t0, onExit }: { list: SayItem[]; t0: number; onExit: (graded: number) => void }) {
  useRecLifecycle();
  const p = useProgress();
  const [i, setI] = useState(0);
  const [hide, setHide] = useState(false);
  const [done, setDone] = useState<Done[] | null>(null);
  const results = useRef<Done[]>([]);
  const it = list[i];

  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [i]);

  if (done) return <SpeakResult results={done} secs={Math.round((Date.now() - t0) / 1000)} onHome={() => onExit(done.length)} />;
  if (!it) return null;

  const next = (g: Grade | null, best: number | null) => {
    if (g !== null) {
      p.grade(it.id, g);
      results.current.push({ it, score: best, g });
    }
    if (i + 1 >= list.length) setDone(results.current);
    else setI(i + 1);
  };

  return (
    <section className="stack en-screen" aria-label="Luyện nói có chấm">
      <div className="sess-top">
        <span className="num" data-testid="sess-count">
          {i + 1}/{list.length}
        </span>
        <div className="bar" role="progressbar" aria-label="Tiến độ phiên" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={i}>
          <i style={{ width: `${(i / list.length) * 100}%` }} />
        </div>
        <button type="button" className="btn ghost small" onClick={() => setDone(results.current)}>
          Kết thúc
        </button>
      </div>
      <SayCard key={it.id} it={it} hide={hide} onHide={setHide} onDone={next} />
      <p className="hint">Điểm = số từ đúng so với câu đích; từ thừa trừ nửa điểm. ≥ 90% → Nhớ rõ, 60–89% → Mơ hồ, dưới 60% → Quên.</p>
    </section>
  );
}

/**
 * Một câu "nói có chấm" (dùng ở lượt luyện nói và trong phiên hằng ngày).
 * `onDone(g, best)`: g = mức chấm theo điểm cao nhất (null = bỏ qua). Đặt `key={it.id}` để làm mới khi đổi câu.
 */
export function SayCard({
  it,
  hide,
  onHide,
  onDone,
}: {
  it: SayItem;
  hide: boolean;
  onHide: (v: boolean) => void;
  onDone: (g: Grade | null, best: number | null) => void;
}) {
  const [best, setBest] = useState<number | null>(null);
  const finish = (g: Grade | null) => {
    speechRec.abort();
    onDone(g, best);
  };
  const g = best === null ? null : gradeForScore(best);
  const cardRef = useFocusOnMount<HTMLDivElement>();

  return (
    <div className="card en-card" ref={cardRef} tabIndex={-1}>
      <div className="kind">
        <span>Nói có chấm · {SAY_SOURCE_VI[it.src]}</span>
        <span className="say-label">{it.label}</span>
      </div>
      {hide ? (
        <>
          <p className="q">{it.vi}</p>
          <p className="hint">Nói câu tiếng Anh tương ứng. Câu đích hiện sau khi chấm.</p>
        </>
      ) : (
        <>
          <p className="q en-sent" lang="en" data-testid="say-target">
            {it.en}
          </p>
          <p className="hint">{it.vi}</p>
        </>
      )}
      <div className="row">
        <button type="button" className="chip" aria-pressed={hide} onClick={() => onHide(!hide)}>
          Ẩn câu (nói theo nghĩa)
        </button>
        <SpeakButton text={it.en} label="Nghe mẫu" {...(hide ? {} : { what: it.en })} />
      </div>
      <SayCheck target={it.en} listen={false} onScored={(r) => setBest((b) => (b === null ? r.score : Math.max(b, r.score)))} />
      {hide && best !== null && (
        <p className="hint" lang="en">
          Câu đích: {it.en}
        </p>
      )}
      <div className="row say-next">
        {g !== null ? (
          <button type="button" className="btn" onClick={() => finish(g)}>
            Tiếp · {GRADE_VI[g]} ({best}%)
          </button>
        ) : null}
        <button type="button" className="btn ghost" onClick={() => finish(null)}>
          Bỏ qua
        </button>
      </div>
      {!speechRec.supported && best === null && (
        <>
          <p className="hint">Không có nhận giọng: tự nói to rồi tự chấm.</p>
          <GradeRow onPick={(x) => finish(x)} />
        </>
      )}
    </div>
  );
}

function SpeakResult({ results, secs, onHome }: { results: Done[]; secs: number; onHome: () => void }) {
  const n = results.length;
  const scored = results.filter((r) => r.score !== null) as (Done & { score: number })[];
  const avg = scored.length ? scored.reduce((a, r) => a + r.score, 0) / scored.length : null;
  const weak = results.filter((r) => r.g < 2);
  return (
    <section className="stack en-screen" aria-labelledby="h-say-result">
      <div className="panel stack">
        <h1 id="h-say-result" className="h-page">
          {n ? 'Xong lượt luyện nói' : 'Chưa chấm câu nào'}
        </h1>
        <div className="stats">
          <div className="stat">
            <b className="num">{n}</b>
            <span>câu đã nói</span>
          </div>
          <div className="stat">
            <b className="num" data-testid="say-avg">
              {avg === null ? '–' : `${fmt(Math.round(avg))}%`}
            </b>
            <span>điểm trung bình</span>
          </div>
          <div className="stat">
            <b className="num">{mmss(secs)}</b>
            <span>thời gian</span>
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={onHome}>
            Về trang Hôm nay
          </button>
        </div>
      </div>
      {weak.length > 0 && (
        <>
          <div className="eyebrow">Nói lại các câu này</div>
          <div className="results">
            {weak.map((r, k) => (
              <details key={k} className="item">
                <summary>
                  <b lang="en">{r.it.en}</b>
                  <span className="tag">{r.score === null ? GRADE_VI[r.g] : `${r.score}%`}</span>
                </summary>
                <div className="body">
                  <div>{r.it.vi}</div>
                  <div className="row">
                    <SpeakButton text={r.it.en} label="Nghe" what={r.it.en} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
