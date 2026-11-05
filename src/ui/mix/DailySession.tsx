import { useEffect, useMemo, useRef, useState } from 'react';
import type { Grade } from '../../core/leitner';
import { defaultRng } from '../../core/rng';
import { useProgress } from '../useProgress';
import { TrCard } from '../../modules/tr/cards/TrCard';
import { PhraseCard } from '../../modules/english/ui/PhraseCard';
import { PatternCard } from '../../modules/english/ui/PatternCard';
import { SayCard } from '../../modules/english/ui/SpeakScreen';
import { TopicRecorder } from '../../modules/english/ui/TopicScreen';
import { cardDir } from '../../modules/english/plan';
import { useTtsLifecycle } from '../../modules/english/useTts';
import { useRecLifecycle } from '../../modules/english/speech/useRec';
import { tts } from '../../modules/english/tts';
import { speechRec } from '../../modules/english/speech/recognizer';
import type { DailyEntry } from '../../modules/mix/plan';
import { LANE_VI, type DailyResult } from '../../modules/mix/result';
import '../../modules/english/english.css';
import '../../modules/english/speech.css';
import { beginSession, endSession, stepSession, useInSessionMark } from '../activeSession';
import './mix.css';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Phiên hằng ngày trộn TR + tiếng Anh: dùng lại nguyên các thẻ TR, thẻ từ / câu mẫu, câu nói có chấm, đề nói 1 phút.
 * Mỗi lượt chấm ghi Leitner ngay (chuỗi ngày, thống kê cập nhật như phiên riêng).
 */
export function DailySession({
  entries,
  t0,
  minutes,
  onFinish,
  start = 0,
  initial,
}: {
  entries: DailyEntry[];
  t0: number;
  minutes: number;
  onFinish: (r: DailyResult[], secs: number) => void;
  /** Tiếp tục phiên dở: vị trí và kết quả đã có. */
  start?: number;
  initial?: DailyResult[];
}) {
  useTtsLifecycle();
  useRecLifecycle();
  useInSessionMark();
  const p = useProgress();
  const [i, setI] = useState(start);
  const [now, setNow] = useState(() => Date.now());
  const [hideSay, setHideSay] = useState(false);
  const results = useRef<DailyResult[]>(initial ?? []);
  const graded = useRef(false);
  const e = entries[i];

  useEffect(() => {
    const saved = results.current.map((r) => ({ i: entries.indexOf(r.entry), g: r.g, ...(r.score !== undefined ? { score: r.score } : {}) }));
    beginSession(
      'mix',
      entries.map((x) => ({ id: x.item.id, lane: x.lane, tier: x.tier, secs: x.secs })),
      t0,
      minutes,
      start,
      saved.filter((r) => r.i >= 0),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Chiều thẻ từ chốt một lần cho mỗi mục.
  const dir = useMemo(() => (e && e.lane === 'en' && e.tier !== 'extra' ? cardDir(p.stateOf(e.item.id), defaultRng) : 'en-vi'), [e]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [i]);

  const finish = () => {
    endSession();
    tts.cancel();
    speechRec.abort();
    onFinish(results.current, Math.round((Date.now() - t0) / 1000));
  };
  const next = () => {
    graded.current = false;
    if (i + 1 >= entries.length) finish();
    else {
      stepSession(i + 1);
      setI(i + 1);
    }
  };
  const record = (g: Grade | null, score?: number | null) => {
    if (!e || graded.current) return;
    graded.current = true;
    if (g !== null && e.tier !== 'extra') p.grade(e.item.id, g);
    else if (g !== null && e.tier === 'extra' && e.item.kind === 'say') p.grade(e.item.item.id, g);
    results.current.push({ entry: e, g, ...(score !== undefined ? { score } : {}) });
    stepSession(i + 1, { i, g, ...(score !== undefined ? { score } : {}) });
  };
  const gradeNext = (g: Grade) => {
    record(g);
    next();
  };

  if (!e) return null;
  const secs = Math.max(0, Math.floor((now - t0) / 1000));
  const laneLabel = e.tier === 'extra' ? 'Luyện nói' : LANE_VI[e.lane];

  return (
    <section className="stack en-screen mix-screen" aria-label="Phiên ôn hôm nay">
      <div className="sess-top">
        <span className="num" data-testid="sess-count">
          {i + 1}/{entries.length}
        </span>
        <div className="bar" role="progressbar" aria-label="Tiến độ phiên" aria-valuemin={0} aria-valuemax={entries.length} aria-valuenow={i}>
          <i style={{ width: `${(i / entries.length) * 100}%` }} />
        </div>
        <span className="num sess-time">
          {mmss(secs)}
          <span className="sess-total"> / {minutes}:00</span>
        </span>
        <button type="button" className="btn ghost small" onClick={finish}>
          Kết thúc
        </button>
      </div>
      <div className="mix-lane" data-lane={e.tier === 'extra' ? 'speak' : e.lane} data-testid="mix-lane">
        {laneLabel}
      </div>
      {e.lane === 'tr' ? (
        <TrCard
          key={i}
          it={e.item}
          state={p.stateOf(e.item.id)}
          note={e.item.type === 'open' ? p.note(e.item.id) : ''}
          onSaveNote={(text) => p.setNote(e.item.id, text)}
          onGrade={(g) => record(g)}
          onNext={next}
        />
      ) : e.tier !== 'extra' ? (
        e.item.type === 'phrase' ? (
          <PhraseCard key={i} ph={e.item.ph} dir={dir} state={p.stateOf(e.item.id)} note={p.note(e.item.id)} onSaveNote={(t) => p.setNote(e.item.id, t)} onGrade={gradeNext} />
        ) : (
          <PatternCard key={i} pt={e.item.pt} state={p.stateOf(e.item.id)} onGrade={gradeNext} />
        )
      ) : e.item.kind === 'say' ? (
        <SayCard
          key={i}
          it={e.item.item}
          hide={hideSay}
          onHide={setHideSay}
          onDone={(g, best) => {
            record(g, best);
            next();
          }}
        />
      ) : (
        <div className="stack" key={i}>
          <p className="hint">Bài nói hôm nay: đọc đề và gợi ý, ghi âm nói liền một mạch rồi nghe lại. Bản ghi chỉ lưu trên máy.</p>
          <TopicRecorder topic={e.item.topic} />
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                record(null);
                next();
              }}
            >
              Xong đề nói · tiếp
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
