import { useEffect, useRef, useState } from 'react';
import { missStore } from '../../../core/misswords';
import { fmt } from '../../../core/num';
import { beginSession, endSession, stepSession, useInSessionMark } from '../../../ui/activeSession';
import { useFocusOnMount } from '../../../ui/useFocusOnMount';
import { useProgress } from '../../../ui/useProgress';
import { DICT_SOURCE_VI, HINT_PENALTY, dictGrade, firstLetters, missedWords, scoreDictation, type DictItem } from '../dictation';
import { GRADE_VI, gradeForScore, type ScoreResult } from '../speech/score';
import { tts } from '../tts';
import { say, useTtsPrefs } from '../useTts';
import { WordDiff } from './SayCheck';
import { SpeakerIcon } from './SpeakButton';
import '../speech.css';

/** Nghe chậm = 0,75 × tốc độ đọc đang chọn trong Cài đặt. */
export const SLOW_FACTOR = 0.75;

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Một câu đã chép. `r` (chi tiết từng từ) không có với câu chép trước khi phiên bị gián đoạn. */
export interface DictDone {
  it: DictItem;
  score: number;
  r?: ScoreResult;
}
type Done = DictDone;

/** Phiên nghe chép: từng câu → nghe → gõ → Kiểm tra → tô từ đúng / sai / thiếu / thừa → kết quả cuối phiên. */
export function DictationScreen({
  list,
  t0,
  onExit,
  start = 0,
  initial,
}: {
  list: DictItem[];
  t0: number;
  onExit: (count: number) => void;
  /** Tiếp tục phiên dở: vị trí và các câu đã chép. */
  start?: number;
  initial?: DictDone[];
}) {
  const p = useProgress();
  const [i, setI] = useState(start);
  const [done, setDone] = useState<{ results: Done[]; secs: number } | null>(null);
  const results = useRef<Done[]>(initial ?? []);
  useInSessionMark(!done);
  useEffect(() => {
    const saved = results.current.map((r) => ({ i: list.indexOf(r.it), g: dictGrade(r.it, r.score), score: r.score })).filter((r) => r.i >= 0);
    beginSession('dict', list.map((x) => ({ id: x.key })), t0, 0, start, saved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const it = list[i];

  // Mốc đo thời gian học: câu đầu tiên tính từ lúc mở phiên nghe chép.
  useEffect(() => p.touch(), [p]);
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [i]);

  if (done) return <DictResult {...done} onHome={() => onExit(done.results.length)} />;
  if (!it) return null;

  const finish = () => {
    endSession();
    tts.cancel();
    setDone({ results: results.current, secs: Math.round((Date.now() - t0) / 1000) });
  };
  const record = (r: ScoreResult) => {
    const g = dictGrade(it, r.score);
    if (it.id && g !== null) p.grade(it.id, g);
    else p.lap('en');
    results.current.push({ it, score: r.score, r });
    stepSession(i + 1, { i, g, score: r.score });
  };
  const next = () => {
    tts.cancel();
    if (i + 1 >= list.length) finish();
    else {
      stepSession(i + 1);
      setI(i + 1);
    }
  };

  return (
    <section className="stack en-screen" aria-label="Nghe chép chính tả">
      <div className="sess-top">
        <span className="num" data-testid="sess-count">
          {i + 1}/{list.length}
        </span>
        <div className="bar" role="progressbar" aria-label="Tiến độ phiên" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={i}>
          <i style={{ width: `${(i / list.length) * 100}%` }} />
        </div>
        <button type="button" className="btn ghost small" onClick={finish}>
          Kết thúc
        </button>
      </div>
      <DictCard key={it.key} it={it} last={i + 1 >= list.length} onScore={record} onNext={next} />
      <p className="hint">
        Không phân biệt hoa/thường, dấu câu, viết tắt (I’m = I am), số (15 = fifteen). Dùng gợi ý trừ {HINT_PENALTY} điểm. ≥ 90% → Nhớ rõ, 60–89% → Mơ hồ, dưới
        60% → Quên.
      </p>
    </section>
  );
}

/** Thẻ một câu nghe chép (dùng cả trong phiên hằng ngày và Ôn điểm yếu). */
export function DictCard({ it, last, onScore, onNext }: {
  it: DictItem; last: boolean; onScore: (r: ScoreResult) => void; onNext: (scored: boolean) => void;
}) {
  const prefs = useTtsPrefs();
  const [plays, setPlays] = useState(0);
  const [hint, setHint] = useState(false);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<ScoreResult | null>(null);
  const cardRef = useFocusOnMount<HTMLDivElement>();
  const checked = useRef(false);
  const actRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // Bàn phím iOS thu nhỏ visualViewport (không đổi layout viewport): kéo nút Kiểm tra vào vùng nhìn thấy.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fix = () => {
      if (document.activeElement === boxRef.current) actRef.current?.scrollIntoView?.({ block: 'nearest' });
    };
    vv.addEventListener('resize', fix);
    return () => vv.removeEventListener('resize', fix);
  }, []);

  // Gọi trực tiếp trong onClick (iOS chỉ cho phát sau thao tác bấm).
  const play = (slow: boolean) => {
    say(it.en, slow ? prefs.rate * SLOW_FACTOR : undefined);
    setPlays((n) => n + 1);
  };
  const check = () => {
    if (!typed.trim() || checked.current) return;
    checked.current = true;
    tts.cancel();
    boxRef.current?.blur();
    const r = scoreDictation(it.en, typed, hint);
    // Đếm từ nghe sai / thiếu cho "Từ hay sai" (chép đúng thì giảm).
    missStore.record(r.words);
    onScore(r);
    setResult(r);
  };
  const g = result ? gradeForScore(result.score) : null;
  const ok = tts.supported;

  return (
    <div className="card en-card dict-card" ref={cardRef} tabIndex={-1}>
      <div className="kind">
        <span>Nghe chép · {DICT_SOURCE_VI[it.src]}</span>
        <span className="num" data-testid="dict-plays">
          Đã nghe {plays} lần
        </span>
      </div>
      <div className="row">
        <button type="button" className="btn say" onClick={() => play(false)} disabled={!ok} aria-label="Nghe câu">
          <SpeakerIcon />
          <span>{result ? 'Nghe lại' : 'Nghe'}</span>
        </button>
        <button type="button" className="btn ghost say" onClick={() => play(true)} disabled={!ok} aria-label="Nghe chậm 0,75×">
          <SpeakerIcon />
          <span>Nghe chậm 0,75×</span>
        </button>
      </div>
      {!ok && <p className="hint">Trình duyệt này không hỗ trợ đọc văn bản.</p>}

      {!result ? (
        <>
          <div className="row">
            <button type="button" className="chip" aria-pressed={hint} onClick={() => setHint(true)}>
              Hiện chữ cái đầu mỗi từ (−{HINT_PENALTY} điểm)
            </button>
          </div>
          {hint && (
            <p className="dict-hint" lang="en" data-testid="dict-hint">
              {firstLetters(it.en)}
            </p>
          )}
          <div className="field">
            <textarea
              ref={boxRef}
              lang="en"
              rows={3}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-label="Gõ lại câu bạn nghe được"
              placeholder="Gõ lại câu bạn nghe được…"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  check();
                }
              }}
            />
          </div>
          <div className="card-act dict-act" ref={actRef}>
            <button type="button" className="btn" disabled={!typed.trim()} onClick={check}>
              Kiểm tra
            </button>
            <button type="button" className="btn ghost" onClick={() => onNext(false)}>
              Bỏ qua
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="say-sr" role="status" data-testid="dict-announce">
            Điểm {result.score}%.
          </p>
          <div className="say-result" data-testid="dict-result">
            <div className="say-score">
              <b className="num" data-testid="dict-score" data-grade={g}>
                {result.score}%
              </b>
              <span>
                {g === 2 ? 'Rất tốt!' : g === 1 ? 'Khá — xem các từ tô màu.' : 'Chưa khớp — nghe lại và so với câu gốc.'}
                <br />
                <span className="hint">
                  {it.id && g !== null ? `Chấm: ${GRADE_VI[g]}` : 'Câu hội thoại: không tính vào lịch ôn'}
                  {hint ? ` · đã trừ ${HINT_PENALTY} điểm gợi ý` : ''}
                </span>
              </span>
            </div>
            <WordDiff r={result} />
            <p className="hint">{it.vi}</p>
            <p className="hint">
              Bạn gõ: <q lang="en">{result.transcript}</q>
            </p>
            <p className="say-legend hint" aria-hidden="true">
              <span className="w-ok">đúng</span> <span className="w-wrong">sai</span> <span className="w-missing">thiếu</span> <ins className="w-extra">+thừa</ins>
            </p>
          </div>
          <div className="card-act dict-act">
            <button type="button" className="btn" onClick={() => onNext(true)}>
              {last ? 'Xem kết quả' : 'Câu tiếp'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DictResult({ results, secs, onHome }: { results: Done[]; secs: number; onHome: () => void }) {
  const n = results.length;
  const avg = n ? results.reduce((a, x) => a + x.score, 0) / n : null;
  const missed = missedWords(results.flatMap((x) => (x.r ? [x.r] : [])));
  return (
    <section className="stack en-screen" aria-labelledby="h-dict-result">
      <div className="panel stack">
        <h1 id="h-dict-result" className="h-page">
          {n ? 'Xong phiên nghe chép' : 'Chưa chép câu nào'}
        </h1>
        <div className="stats">
          <div className="stat">
            <b className="num">{n}</b>
            <span>câu đã chép</span>
          </div>
          <div className="stat">
            <b className="num" data-testid="dict-avg">
              {avg === null ? '–' : `${fmt(Math.round(avg))}%`}
            </b>
            <span>điểm trung bình</span>
          </div>
          <div className="stat">
            <b className="num">{mmss(secs)}</b>
            <span>thời gian</span>
          </div>
        </div>
        {missed.length > 0 && (
          <div>
            <div className="eyebrow">Từ hay nghe sai</div>
            <p className="dict-missed" lang="en" data-testid="dict-missed">
              {missed.map((m) => (
                <span key={m.word} className="tag">
                  {m.word}
                  {m.n > 1 ? ` ×${m.n}` : ''}
                </span>
              ))}
            </p>
          </div>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={onHome}>
            Về trang Hôm nay
          </button>
        </div>
      </div>
      {n > 0 && (
        <div className="results">
          {results.map((x, k) => (
            <details key={k} className="item">
              <summary>
                <b lang="en">{x.it.en}</b>
                <span className="tag">{x.score}%</span>
              </summary>
              <div className="body">
                <div>{x.it.vi}</div>
                {x.r && <WordDiff r={x.r} />}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
