import { useEffect, useMemo, useRef, useState } from 'react';
import type { Grade } from '../../../core/leitner';
import { fmt } from '../../../core/num';
import { defaultRng } from '../../../core/rng';
import { useProgress } from '../../../ui/useProgress';
import { titleOfEn, type EnItem, type EnType } from '../content';
import { cardDir } from '../plan';
import { allTracks, type Track } from '../tracks';
import { useTtsLifecycle } from '../useTts';
import { PatternCard } from './PatternCard';
import { PhraseCard } from './PhraseCard';
import { ShadowPlayerView } from './ShadowPlayerView';
import { SpeakScreen, type SpeakDone } from './SpeakScreen';
import { TopicScreen } from './TopicScreen';
import { DictationScreen } from './DictationScreen';
import type { DictItem } from '../dictation';
import type { SayItem } from '../speech/sayItems';
import { beginSession, endSession, stepSession, useInSessionMark } from '../../../ui/activeSession';
import { SCREEN_CAP_SECS } from '../../../core/studytime';
import '../english.css';

export type EnView =
  | { kind: 'cards'; type: EnType; list: EnItem[]; t0: number; minutes: number; pos?: number; done?: EnCardResult[] }
  | { kind: 'shadow'; t0: number }
  | { kind: 'speak'; list: SayItem[]; t0: number; pos?: number; done?: SpeakDone[] }
  | { kind: 'topics'; t0: number }
  | { kind: 'dictation'; list: DictItem[]; t0: number };

export interface EnCardResult {
  it: EnItem;
  g: Grade;
}
type Result = EnCardResult;

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Màn luyện tiếng Anh mở từ trang Hôm nay. Hủy đọc khi rời màn (unmount, đổi tab, ẩn app). */
export function EnglishScreen({ view, onExit }: { view: EnView; onExit: () => void }) {
  useTtsLifecycle();
  const p = useProgress();
  const [done, setDone] = useState<{ results: Result[]; secs: number } | null>(null);
  const finish = (results: Result[]) => {
    const secs = Math.round((Date.now() - view.t0) / 1000);
    if (results.length || view.kind === 'shadow') p.addSeconds(secs);
    // Shadowing không có lượt chấm: tính theo thời gian mở màn (tối đa 30 phút/lần).
    if (view.kind === 'shadow') p.addStudy('en', Math.min(secs, SCREEN_CAP_SECS));
    if (view.kind === 'shadow') onExit();
    else setDone({ results, secs });
  };

  if (done) return <EnResult {...done} onHome={onExit} />;
  if (view.kind === 'speak' || view.kind === 'topics' || view.kind === 'dictation') {
    const leave = (count: number) => {
      if (count > 0 || view.kind === 'topics') p.addSeconds(Math.round((Date.now() - view.t0) / 1000));
      if (view.kind === 'topics') p.addStudy('speak', Math.min(Math.round((Date.now() - view.t0) / 1000), SCREEN_CAP_SECS));
      onExit();
    };
    if (view.kind === 'dictation') return <DictationScreen list={view.list} t0={view.t0} onExit={leave} />;
    return view.kind === 'speak' ? <SpeakScreen list={view.list} t0={view.t0} onExit={leave} start={view.pos ?? 0} initial={view.done ?? []} /> : <TopicScreen onExit={() => leave(0)} />;
  }
  if (view.kind === 'shadow') return <ShadowScreen onExit={() => finish([])} />;
  return (
    <CardSession list={view.list} type={view.type} t0={view.t0} minutes={view.minutes} onFinish={finish} start={view.pos ?? 0} initial={view.done ?? []} />
  );
}

function CardSession({
  list,
  type,
  t0,
  minutes,
  onFinish,
  start,
  initial,
}: {
  list: EnItem[];
  type: EnType;
  t0: number;
  minutes: number;
  onFinish: (r: Result[]) => void;
  start: number;
  initial: Result[];
}) {
  useInSessionMark();
  const p = useProgress();
  const [i, setI] = useState(start);
  const [now, setNow] = useState(() => Date.now());
  const results = useRef<Result[]>(initial);

  useEffect(() => {
    const saved = results.current.map((r) => ({ i: list.indexOf(r.it), g: r.g })).filter((r) => r.i >= 0);
    beginSession(type === 'phrase' ? 'en-phrase' : 'en-pattern', list.map((x) => ({ id: x.id })), t0, minutes, start, saved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const end = (r: Result[]) => {
    endSession();
    onFinish(r);
  };
  const it = list[i];
  // Chiều thẻ chốt một lần cho mỗi thẻ (không đổi khi chấm làm state thay đổi).
  const dir = useMemo(() => (it ? cardDir(p.stateOf(it.id), defaultRng) : 'en-vi'), [it]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [i]);

  if (!it) return null;
  const grade = (g: Grade) => {
    p.grade(it.id, g);
    results.current.push({ it, g });
    if (i + 1 >= list.length) end(results.current);
    else {
      stepSession(i + 1, { i, g });
      setI(i + 1);
    }
  };

  return (
    <section className="stack en-screen" aria-label={type === 'phrase' ? 'Phiên thẻ từ' : 'Phiên câu mẫu'}>
      <div className="sess-top">
        <span className="num" data-testid="sess-count">
          {i + 1}/{list.length}
        </span>
        <div className="bar" role="progressbar" aria-label="Tiến độ phiên" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={i}>
          <i style={{ width: `${(i / list.length) * 100}%` }} />
        </div>
        <span className="num sess-time">
          {mmss(Math.max(0, Math.floor((now - t0) / 1000)))}
          <span className="sess-total"> / {minutes}:00</span>
        </span>
        <button type="button" className="btn ghost small" onClick={() => end(results.current)}>
          Kết thúc
        </button>
      </div>
      {it.type === 'phrase' ? (
        <PhraseCard key={it.id} ph={it.ph} dir={dir} state={p.stateOf(it.id)} note={p.note(it.id)} onSaveNote={(t) => p.setNote(it.id, t)} onGrade={grade} />
      ) : (
        <PatternCard key={it.id} pt={it.pt} state={p.stateOf(it.id)} onGrade={grade} />
      )}
    </section>
  );
}

function ShadowScreen({ onExit }: { onExit: () => void }) {
  const tracks = useMemo(() => allTracks(), []);
  const [track, setTrack] = useState<Track | null>(null);
  return (
    <section className="stack en-screen" aria-labelledby="h-shadow">
      <div className="sess-top">
        <h1 id="h-shadow" className="h-page sh-title">
          {track ? track.title : 'Shadowing'}
        </h1>
        {track && (
          <button type="button" className="btn ghost small" onClick={() => setTrack(null)}>
            Chọn bài
          </button>
        )}
        <button type="button" className="btn ghost small" onClick={onExit}>
          Xong
        </button>
      </div>
      {track ? (
        <ShadowPlayerView key={track.id} track={track} />
      ) : (
        <>
          <p className="hint">Chọn một bài. Mỗi câu được đọc rồi nghỉ một quãng để bạn nhại theo; bật “Lặp câu” để luyện kỹ một câu.</p>
          <div className="sh-tracks">
            {tracks.map((t) => (
              <button key={t.id} type="button" className="opt" onClick={() => setTrack(t)}>
                <span>
                  <b>{t.title}</b>
                  <br />
                  <span className="hint">{t.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function EnResult({ results, secs, onHome }: { results: Result[]; secs: number; onHome: () => void }) {
  const n = results.length;
  const ok = results.filter((r) => r.g === 2).length;
  const wrong = results.filter((r) => r.g === 0);
  return (
    <section className="stack en-screen" aria-labelledby="h-en-result">
      <div className="panel stack">
        <h1 id="h-en-result" className="h-page">
          {n ? 'Xong phiên tiếng Anh' : 'Phiên chưa chấm thẻ nào'}
        </h1>
        <div className="stats">
          <div className="stat">
            <b className="num">{n}</b>
            <span>thẻ đã ôn</span>
          </div>
          <div className="stat">
            <b className="num">{n ? `${fmt((ok / n) * 100)}%` : '–'}</b>
            <span>nhớ rõ</span>
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
      {wrong.length > 0 && (
        <>
          <div className="eyebrow">Ôn lại hôm nay</div>
          <div className="results">
            {wrong.map((r, k) => (
              <details key={k} className="item">
                <summary>
                  <b lang="en">{titleOfEn(r.it)}</b>
                </summary>
                <div className="body">
                  {r.it.type === 'phrase' ? (
                    <>
                      <div>{r.it.ph.vi}</div>
                      <div className="hint" lang="en">
                        {r.it.ph.example}
                      </div>
                    </>
                  ) : (
                    <div>{r.it.pt.vi}</div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
