import { useEffect, useMemo, useRef, useState } from 'react';
import type { Grade } from '../../../core/leitner';
import { fmt } from '../../../core/num';
import { useInSessionMark } from '../../../ui/activeSession';
import { useProgress } from '../../../ui/useProgress';
import { GradeRow } from '../../tr/cards/TrCard';
import { TOPICS, TOPIC_VI, type Topic } from '../content';
import {
  HINT_LEVELS,
  RP_DIALOGUES,
  RP_LEVELS,
  buildTurns,
  defaultRole,
  hintFor,
  loadHint,
  loadRpStore,
  needsSelfGrade,
  saveHint,
  saveRpRecord,
  summarize,
  turnResult,
  weakTurns,
  type HintLevel,
  type RpDialogue,
  type RpStore,
  type Turn,
  type TurnResult,
} from '../roleplay';
import { REC_ERROR_VI, speechRec, type RecErrorCode } from '../speech/recognizer';
import { GRADE_VI, bestOf, type ScoreResult } from '../speech/score';
import { useRecLifecycle, useRecState } from '../speech/useRec';
import { tts } from '../tts';
import { say, useTtsPrefs } from '../useTts';
import { MicIcon, WordDiff } from './SayCheck';
import { SpeakButton, SpeakerIcon } from './SpeakButton';
import '../speech.css';
import '../roleplay.css';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const scoreTag = (r: { score: number | null; g: Grade }) => (r.score === null ? GRADE_VI[r.g] : `${r.score}%`);

type Stage =
  | { k: 'pick' }
  /** `only`: chỉ luyện lại các câu điểm thấp (vai đã chốt, không lưu kết quả bài). */
  | { k: 'play'; d: RpDialogue; run: number; role?: string; only?: readonly number[] }
  | { k: 'done'; d: RpDialogue; role: string; results: TurnResult[]; secs: number; retry: boolean };

/** Hội thoại nhập vai: chọn bài + vai → app đọc lượt của vai kia, người học nói lượt mình → kết quả. */
export function RoleplayScreen({ onExit }: { onExit: (spoken: number) => void }) {
  useRecLifecycle();
  const p = useProgress();
  const [stage, setStage] = useState<Stage>({ k: 'pick' });
  const [store, setStore] = useState<RpStore>({});
  const [hint, setHintState] = useState<HintLevel>('full');
  const spoken = useRef(0);
  useInSessionMark(stage.k === 'play');

  useEffect(() => {
    let live = true;
    // Gộp (không ghi đè) phòng khi vừa luyện xong một bài trước lúc đọc xong IndexedDB.
    void loadRpStore().then((s) => live && setStore((cur) => ({ ...s, ...cur })));
    void loadHint().then((h) => live && setHintState(h));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [stage]);

  const setHint = (h: HintLevel) => {
    setHintState(h);
    void saveHint(h);
  };
  const exit = () => onExit(spoken.current);

  if (stage.k === 'pick') return <Picker store={store} onPick={(d) => setStage({ k: 'play', d, run: 0 })} onExit={exit} />;

  if (stage.k === 'play') {
    const { d, only } = stage;
    return (
      <Play
        key={`${d.id}:${stage.run}`}
        d={d}
        only={only}
        initialRole={stage.role ?? store[d.id]?.role}
        hint={hint}
        onHint={setHint}
        onBack={() => setStage({ k: 'pick' })}
        onFinish={(role, results, secs, total) => {
          spoken.current += results.length;
          if (results.length && !only) {
            const rec = { day: p.today(), at: Date.now(), score: summarize(results).avg, role, n: results.length, total };
            setStore((s) => ({ ...s, [d.id]: rec }));
            void saveRpRecord(d.id, rec).catch(() => undefined);
          }
          setStage({ k: 'done', d, role, results, secs, retry: !!only });
        }}
      />
    );
  }

  const { d, role, results } = stage;
  const again = (only?: readonly number[]) => setStage({ k: 'play', d, role, run: Date.now(), ...(only ? { only } : {}) });
  return <Result {...stage} onWeak={() => again(summarize(results).weak.map((r) => r.turn.i))} onAgain={() => again()} onPick={() => setStage({ k: 'pick' })} onHome={exit} />;
}

function Picker({ store, onPick, onExit }: { store: RpStore; onPick: (d: RpDialogue) => void; onExit: () => void }) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const list = RP_DIALOGUES.filter((d) => (!topic || d.topic === topic) && (!level || d.level === level));
  const doneCount = RP_DIALOGUES.filter((d) => store[d.id]).length;
  return (
    <section className="stack en-screen" aria-labelledby="h-rp">
      <div className="sess-top">
        <h1 id="h-rp" className="h-page sh-title">
          Nhập vai
        </h1>
        <button type="button" className="btn ghost small" onClick={onExit}>
          Xong
        </button>
      </div>
      <p className="hint">
        Chọn một hội thoại rồi chọn vai. App đọc lượt của vai kia, đến lượt bạn thì bấm micro và nói. Đã luyện {doneCount}/{RP_DIALOGUES.length} bài.
      </p>
      <div className="row" role="group" aria-label="Lọc theo chủ đề">
        <button type="button" className="chip" aria-pressed={topic === null} onClick={() => setTopic(null)}>
          Mọi chủ đề
        </button>
        {TOPICS.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={topic === t} onClick={() => setTopic(t)}>
            {TOPIC_VI[t]}
          </button>
        ))}
      </div>
      <div className="row" role="group" aria-label="Lọc theo trình độ">
        <button type="button" className="chip" aria-pressed={level === null} onClick={() => setLevel(null)}>
          Mọi trình độ
        </button>
        {RP_LEVELS.map((l) => (
          <button key={l} type="button" className="chip" aria-pressed={level === l} onClick={() => setLevel(l)}>
            {l}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="hint">Không có hội thoại nào khớp bộ lọc.</p>}
      <div className="sh-tracks" data-testid="rp-list">
        {list.map((d) => {
          const rec = store[d.id];
          return (
            <button key={d.id} type="button" className="opt rp-opt" onClick={() => onPick(d)} data-done={rec ? '' : undefined}>
              <span className="rp-opt-main">
                <b lang="en">{d.title}</b>
                <span className="hint">{d.situation}</span>
                <span className="hint">
                  {TOPIC_VI[d.topic]} · {d.level} · {d.lines.length} câu
                </span>
              </span>
              {rec && (
                <span className="tag rp-done">
                  Đã luyện · {rec.score === null ? 'tự chấm' : `${rec.score}%`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type Phase = 'setup' | 'speaking' | 'paused' | 'mine';

function Play({
  d,
  only,
  initialRole,
  hint,
  onHint,
  onBack,
  onFinish,
}: {
  d: RpDialogue;
  only?: readonly number[] | undefined;
  initialRole?: string | undefined;
  hint: HintLevel;
  onHint: (h: HintLevel) => void;
  onBack: () => void;
  onFinish: (role: string, results: TurnResult[], secs: number, total: number) => void;
}) {
  const p = useProgress();
  const prefs = useTtsPrefs();
  const [role, setRole] = useState(() => (initialRole && d.roles.some((r) => r.speaker === initialRole) ? initialRole : defaultRole(d)));
  const [phase, setPhase] = useState<Phase>('setup');
  const [pos, setPos] = useState(0);
  /** Lỗi nhận giọng khiến cả phiên chuyển sang tự đánh giá. */
  const [selfErr, setSelfErr] = useState<RecErrorCode | null>(speechRec.supported ? null : 'unsupported');
  const results = useRef<TurnResult[]>([]);
  /** Bản sao của `results` để hiện điểm trên các bong bóng đã qua. */
  const [shown, setShown] = useState<readonly TurnResult[]>([]);
  const token = useRef(0);
  const t0 = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const turns = useMemo(() => {
    const all = buildTurns(d, role);
    return only ? weakTurns(all, only) : all;
  }, [d, role, only]);
  const mineTotal = turns.filter((t) => t.mine).length;
  const others = d.roles.filter((r) => r.speaker !== role).map((r) => r.speaker);

  // Rời màn: chặn chuỗi đọc nối tiếp (TTS / micro do hook vòng đời hủy).
  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );
  useEffect(() => {
    if (phase !== 'setup') endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [pos, phase]);

  const finish = () => {
    token.current++;
    tts.cancel();
    speechRec.abort();
    onFinish(role, results.current, t0.current ? Math.round((Date.now() - t0.current) / 1000) : 0, mineTotal);
  };

  /** Chạy từ lượt k: lượt của vai kia thì đọc rồi tự nối tiếp; lượt của người học thì dừng chờ. Lần đầu gọi trong handler bấm (iOS). */
  const run = (k: number) => {
    const my = ++token.current;
    const t = turns[k];
    if (!t) {
      finish();
      return;
    }
    setPos(k);
    if (t.mine) {
      setPhase('mine');
      return;
    }
    setPhase('speaking');
    speechRec.abort();
    void tts.speak(t.en, { rate: prefs.rate, accent: prefs.accent, voiceRank: Math.max(0, others.indexOf(t.speaker)) }).then((res) => {
      if (my !== token.current) return;
      // Bị hủy (ẩn app, đổi tab): dừng lại, chờ người học bấm "Nghe tiếp".
      if (res === 'cancel') setPhase('paused');
      else run(k + 1);
    });
  };

  const start = () => {
    t0.current = Date.now();
    p.touch();
    run(0);
  };

  const commit = (r: TurnResult | null) => {
    if (r) {
      results.current.push(r);
      setShown([...results.current]);
      // Câu ≥ 4 từ dùng chung lịch Leitner "en:say:…" với Luyện nói (tính lượt ôn trong ngày, thời gian nói, điểm nói).
      if (r.turn.sayId) p.grade(r.turn.sayId, r.g, { speak: true, score: r.score });
      else p.lap('speak', r.score);
    }
    run(pos + 1);
  };

  const cur = turns[pos];
  const scoreOf = (t: Turn) => shown.find((r) => r.turn.i === t.i);

  if (phase === 'setup') {
    return (
      <section className="stack en-screen" aria-labelledby="h-rp-setup">
        <div className="sess-top">
          <span className="eyebrow rp-grow">Nhập vai{only ? ' · luyện lại câu điểm thấp' : ''}</span>
          <button type="button" className="btn ghost small" onClick={onBack}>
            Chọn bài
          </button>
        </div>
        <div className="card en-card rp-card">
          <h1 id="h-rp-setup" className="h-page" lang="en">
            {d.title}
          </h1>
          <p>{d.situation}</p>
          <p className="hint">
            {TOPIC_VI[d.topic]} · {d.level} · {mineTotal} lượt của bạn / {turns.length} câu
          </p>
          <div>
            <div className="eyebrow">Bạn đóng vai</div>
            <div className="row rp-chips" role="group" aria-label="Chọn vai">
              {d.roles.map((r) => (
                <button key={r.speaker} type="button" className="chip" aria-pressed={role === r.speaker} disabled={!!only} onClick={() => setRole(r.speaker)}>
                  {r.speaker} · {r.name}
                </button>
              ))}
            </div>
          </div>
          <HintChips hint={hint} onHint={onHint} />
          {!tts.supported && <p className="hint">Trình duyệt này không hỗ trợ đọc văn bản: lượt của vai kia chỉ hiện chữ.</p>}
          {selfErr && <p className="hint">{REC_ERROR_VI[selfErr]} Bạn vẫn luyện được: nói to rồi tự đánh giá Quên / Mơ hồ / Nhớ rõ.</p>}
          <div className="card-act">
            <button type="button" className="btn" disabled={mineTotal === 0} onClick={start}>
              Bắt đầu
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="stack en-screen" aria-label="Hội thoại nhập vai">
      <div className="sess-top">
        <span className="num" data-testid="sess-count">
          {pos + 1}/{turns.length}
        </span>
        <div className="bar" role="progressbar" aria-label="Tiến độ hội thoại" aria-valuemin={0} aria-valuemax={turns.length} aria-valuenow={pos}>
          <i style={{ width: `${(pos / turns.length) * 100}%` }} />
        </div>
        <button type="button" className="btn ghost small" onClick={finish}>
          Kết thúc
        </button>
      </div>
      <HintChips hint={hint} onHint={onHint} />
      <div className="card en-card rp-card">
        <ol className="rp-chat" aria-label="Các lượt đã qua">
          {turns.slice(0, pos).map((t) => {
            const r = scoreOf(t);
            return (
              <li key={t.i} className={`rp-b ${t.mine ? 'me' : 'them'}`}>
                <span className="rp-who">
                  {t.mine ? 'Bạn' : t.name}
                  {t.mine && <span className="tag">{r ? scoreTag(r) : 'bỏ qua'}</span>}
                </span>
                <span lang="en">{t.en}</span>
              </li>
            );
          })}
        </ol>
        {cur && !cur.mine && (
          <>
            <div className="rp-b them cur" data-testid="rp-current" aria-live="polite" ref={endRef}>
              <span className="rp-who">
                {cur.name}
                {phase === 'speaking' && (
                  <span className="rp-now">
                    <SpeakerIcon /> đang nói…
                  </span>
                )}
              </span>
              <span lang="en">{cur.en}</span>
              <span className="hint">{cur.vi}</span>
            </div>
            <div className="card-act rp-act">
              {phase === 'paused' ? (
                <button type="button" className="btn" onClick={() => run(pos)}>
                  Nghe tiếp
                </button>
              ) : (
                <button type="button" className="btn ghost" onClick={() => run(pos + 1)}>
                  Bỏ qua câu này
                </button>
              )}
            </div>
          </>
        )}
        {cur?.mine && (
          <MyTurn key={cur.i} turn={cur} hint={hint} selfErr={selfErr} onSelfErr={setSelfErr} last={pos + 1 >= turns.length} onDone={commit} endRef={endRef} />
        )}
      </div>
    </section>
  );
}

function HintChips({ hint, onHint }: { hint: HintLevel; onHint: (h: HintLevel) => void }) {
  return (
    <div className="row rp-chips" role="group" aria-label="Mức gợi ý ở lượt của bạn">
      <span className="hint">Gợi ý:</span>
      {HINT_LEVELS.map((h) => (
        <button key={h.id} type="button" className="chip" aria-pressed={hint === h.id} onClick={() => onHint(h.id)}>
          {h.label}
        </button>
      ))}
    </div>
  );
}

/** Lượt của người học: gợi ý theo mức → bấm micro nói → điểm từng từ; không có nhận giọng thì tự đánh giá. */
function MyTurn({
  turn,
  hint,
  selfErr,
  onSelfErr,
  last,
  onDone,
  endRef,
}: {
  turn: Turn;
  hint: HintLevel;
  selfErr: RecErrorCode | null;
  onSelfErr: (e: RecErrorCode | null) => void;
  last: boolean;
  onDone: (r: TurnResult | null) => void;
  endRef: React.RefObject<HTMLDivElement>;
}) {
  const s = useRecState();
  const [mine, setMine] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [err, setErr] = useState<RecErrorCode | null>(null);
  const [peek, setPeek] = useState(false);
  const mineRef = useRef(false);

  useEffect(
    () => () => {
      if (mineRef.current) speechRec.abort();
    },
    [],
  );
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [result, selfErr, endRef]);

  const listening = mine && s.status !== 'idle';
  const toggle = () => {
    if (listening) {
      speechRec.stop();
      return;
    }
    tts.cancel(); // micro không thu tiếng máy đọc
    setErr(null);
    setResult(null);
    mineRef.current = true;
    setMine(true);
    // Gọi start ngay trong handler bấm (iOS).
    void speechRec.start({ lang: 'en-US' }).then((out) => {
      mineRef.current = false;
      setMine(false);
      if (out.aborted) return;
      if (out.error) {
        if (needsSelfGrade(out.error)) onSelfErr(out.error);
        else setErr(out.error);
        return;
      }
      const r = bestOf(turn.en, out.alternatives.length ? out.alternatives : [out.transcript]);
      setResult(r);
      setBest((b) => (b === null ? r.score : Math.max(b, r.score)));
    });
  };
  const done = (self: Grade | null) => {
    speechRec.abort();
    tts.cancel();
    onDone(turnResult(turn, best, self));
  };

  const show = hintFor(hint, result !== null || peek);
  const live = listening ? [s.final, s.interim].filter(Boolean).join(' ') : '';
  const listen = (
    <button type="button" className="btn ghost say" onClick={() => say(turn.en)} disabled={!tts.supported}>
      <SpeakerIcon />
      <span>Nghe mẫu</span>
    </button>
  );

  return (
    <>
      <div className="rp-b me cur" data-testid="rp-current" ref={endRef}>
        <span className="rp-who">Lượt của bạn · {turn.name}</span>
        {result ? (
          <WordDiff r={result} />
        ) : show.en ? (
          <span lang="en" className="rp-target" data-testid="rp-target">
            {turn.en}
          </span>
        ) : (
          <span className="hint">{show.vi ? 'Nói câu tiếng Anh tương ứng:' : 'Tự nhớ và nói câu của bạn.'}</span>
        )}
        {show.vi && <span className={show.en ? 'hint' : 'rp-vi'}>{turn.vi}</span>}
        {result && (
          <span className="hint">
            Máy nghe được: <q lang="en">{result.transcript || '…'}</q>
          </span>
        )}
      </div>

      <div aria-live="polite" className="say-live">
        {listening && (
          <p className="hint" data-testid="say-live">
            <span className="say-dot" aria-hidden="true" /> Đang nghe… {live && <q lang="en">{live}</q>}
          </p>
        )}
      </div>
      <p className="say-sr" role="status">
        {result ? `Điểm ${result.score}%.` : ''}
      </p>
      {err && (
        <p className="say-err" role="alert" data-testid="say-err">
          {REC_ERROR_VI[err]}
        </p>
      )}

      {selfErr ? (
        <>
          <p className="say-err" role="alert" data-testid="rp-self">
            {REC_ERROR_VI[selfErr]} Hãy nói to câu của bạn, xem câu mẫu rồi tự đánh giá.
          </p>
          <div className="card-act rp-act">
            <GradeRow onPick={(g) => done(g)} />
            {!show.en ? (
              <button type="button" className="btn ghost" onClick={() => setPeek(true)}>
                Xem câu mẫu
              </button>
            ) : (
              <button type="button" className="btn ghost" onClick={() => done(null)}>
                Bỏ qua
              </button>
            )}
            {listen}
            {speechRec.supported && (
              <button type="button" className="btn ghost rp-wide" onClick={() => onSelfErr(null)}>
                Thử lại micro
              </button>
            )}
          </div>
        </>
      ) : result ? (
        <div className="card-act rp-act">
          <button type="button" className="btn" onClick={() => done(null)}>
            {last ? 'Xem kết quả' : 'Tiếp'} ·{' '}
            <span className="num" data-testid="rp-score">
              {best}%
            </span>
          </button>
          <button type="button" className="btn ghost say-mic" onClick={toggle}>
            <MicIcon />
            <span>Nói lại</span>
          </button>
          {listen}
        </div>
      ) : (
        <div className="card-act rp-act">
          <button type="button" className={`btn say-mic rp-mic${listening ? ' on' : ''}`} onClick={toggle} disabled={s.status === 'stopping'} aria-pressed={listening}>
            <MicIcon />
            <span>{listening ? (s.status === 'stopping' ? 'Đang chấm…' : 'Dừng') : best === null ? 'Bấm để nói' : 'Nói lại'}</span>
          </button>
          {listen}
          <button type="button" className="btn ghost" onClick={() => done(null)}>
            {best === null ? 'Bỏ qua' : `Tiếp · ${best}%`}
          </button>
        </div>
      )}
    </>
  );
}

function Result({
  d,
  role,
  results,
  secs,
  retry,
  onWeak,
  onAgain,
  onPick,
  onHome,
}: {
  d: RpDialogue;
  role: string;
  results: TurnResult[];
  secs: number;
  retry: boolean;
  onWeak: () => void;
  onAgain: () => void;
  onPick: () => void;
  onHome: () => void;
}) {
  const sum = summarize(results);
  const roleName = d.roles.find((r) => r.speaker === role)?.name ?? role;
  return (
    <section className="stack en-screen" aria-labelledby="h-rp-result">
      <div className="panel stack">
        <div>
          <div className="eyebrow">
            Nhập vai · {roleName}
            {retry ? ' · luyện lại' : ''}
          </div>
          <h1 id="h-rp-result" className="h-page">
            {sum.n ? 'Xong hội thoại' : 'Chưa nói lượt nào'}
          </h1>
          <p className="hint" lang="en">
            {d.title}
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <b className="num">{sum.n}</b>
            <span>lượt đã nói</span>
          </div>
          <div className="stat">
            <b className="num" data-testid="rp-avg">
              {sum.avg === null ? '–' : `${fmt(sum.avg)}%`}
            </b>
            <span>điểm trung bình</span>
          </div>
          <div className="stat">
            <b className="num">{mmss(secs)}</b>
            <span>thời gian</span>
          </div>
        </div>
        <div className="rp-result-act">
          {sum.weak.length > 0 && (
            <button type="button" className="btn" onClick={onWeak}>
              Luyện lại {sum.weak.length} câu điểm thấp
            </button>
          )}
          <button type="button" className={`btn${sum.weak.length ? ' ghost' : ''}`} onClick={onAgain}>
            Đóng vai lại cả bài
          </button>
          <button type="button" className="btn ghost" onClick={onPick}>
            Chọn bài khác
          </button>
          <button type="button" className="btn ghost" onClick={onHome}>
            Về trang Hôm nay
          </button>
        </div>
      </div>
      {sum.weak.length > 0 && (
        <>
          <div className="eyebrow">Câu điểm thấp</div>
          <div className="results" data-testid="rp-weak">
            {sum.weak.map((r) => (
              <details key={r.turn.i} className="item">
                <summary>
                  <b lang="en">{r.turn.en}</b>
                  <span className="tag">{scoreTag(r)}</span>
                </summary>
                <div className="body">
                  <div>{r.turn.vi}</div>
                  <div className="row">
                    <SpeakButton text={r.turn.en} label="Nghe" what={r.turn.en} />
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
