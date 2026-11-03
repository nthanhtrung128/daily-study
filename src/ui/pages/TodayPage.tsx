import { useEffect, useRef, useState } from 'react';
import { getSetting, setSetting } from '../../core/db';
import type { Grade } from '../../core/leitner';
import { fmt } from '../../core/num';
import { RangeBar } from '../components/RangeBar';
import { useProgress } from '../useProgress';
import { BAI_KEYS, BAI_SHORT } from '../../modules/tr/data';
import { titleOf, type TrItem } from '../../modules/tr/items';
import { DEFAULT_PREFS, DURATIONS, MODES, countBy, homeStats, modeOf, planSession, type Prefs } from '../../modules/tr/plan';
import { Explain, TrCard } from '../../modules/tr/cards/TrCard';
import { EnglishHome } from '../../modules/english/ui/EnglishHome';
import { EnglishScreen, type EnView } from '../../modules/english/ui/EnglishScreen';

const PREFS_KEY = 'tr.prefs';

interface Result {
  it: TrItem;
  g: Grade;
}
type View = { kind: 'home' } | { kind: 'session'; list: TrItem[]; t0: number } | { kind: 'result'; results: Result[]; secs: number };

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

export function TodayPage() {
  const p = useProgress();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [en, setEn] = useState<EnView | null>(null);

  useEffect(() => {
    let live = true;
    void getSetting<Prefs>(PREFS_KEY, DEFAULT_PREFS)
      .then((v) => live && setPrefs({ ...DEFAULT_PREFS, ...v }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void setSetting(PREFS_KEY, next).catch(() => undefined);
  };

  const start = (pr: Prefs = prefs) => {
    const list = planSession(pr, p.stateOf, p.today());
    if (list.length) setView({ kind: 'session', list, t0: Date.now() });
  };

  if (en) return <EnglishScreen view={en} onExit={() => setEn(null)} />;
  if (view.kind === 'session') {
    return (
      <Session
        list={view.list}
        t0={view.t0}
        minutes={prefs.min}
        onFinish={(results, secs) => {
          if (results.length) p.addSeconds(secs);
          setView({ kind: 'result', results, secs });
        }}
      />
    );
  }
  if (view.kind === 'result') {
    return (
      <ResultView
        {...view}
        onMore={() => {
          const next = { ...prefs, min: 5 };
          update({ min: 5 });
          start(next);
        }}
        onHome={() => setView({ kind: 'home' })}
      />
    );
  }

  const today = p.today();
  const st = homeStats(p.stateOf, today);
  const plan = planSession(prefs, p.stateOf, today, { dry: true });
  const mode = modeOf(prefs.mode);

  return (
    <section className="stack" aria-labelledby="h-today">
      <div className="panel stack">
        <div>
          <RangeBar value={st.pen} />
          <p className="hint" style={{ marginTop: 8 }}>
            Range penetration kiến thức: <span className="num">{fmt(st.pen * 100, 1)}%</span> · {st.learned}/{st.tracked} mục đã
            thuộc (hộp Leitner 4–5).
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <b className="num" data-testid="st-due">{st.due}</b>
            <span>đến hạn ôn hôm nay</span>
          </div>
          <div className="stat">
            <b className="num" data-testid="st-wrong">{st.wrong}</b>
            <span>câu từng làm sai</span>
          </div>
          <div className="stat">
            <b className="num" data-testid="st-today">{p.dayStat(today).n}</b>
            <span>mục đã ôn hôm nay</span>
          </div>
        </div>
      </div>

      <div className="panel stack">
        <h1 id="h-today" className="h-page">
          Hôm nay ôn bao lâu?
        </h1>
        <div className="row" role="group" aria-label="Thời lượng">
          {DURATIONS.map((m) => (
            <Chip key={m} pressed={prefs.min === m} onClick={() => update({ min: m })}>
              {`${m} phút`}
            </Chip>
          ))}
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Cách ôn
          </div>
          <div className="row" role="group" aria-label="Cách ôn">
            {MODES.map((m) => (
              <Chip key={m.id} pressed={prefs.mode === m.id} onClick={() => update({ mode: m.id })}>
                {m.label}
              </Chip>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            {mode.hint}
          </p>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Buổi học
          </div>
          <div className="row" role="group" aria-label="Buổi học">
            <Chip pressed={!prefs.bai.length} onClick={() => update({ bai: [] })}>
              Tất cả
            </Chip>
            {BAI_KEYS.map((k) => (
              <Chip
                key={k}
                pressed={prefs.bai.includes(k)}
                onClick={() => update({ bai: prefs.bai.includes(k) ? prefs.bai.filter((x) => x !== k) : [...prefs.bai, k] })}
              >
                {k === 'Bổ sung' ? 'Pháp lý VN' : `Buổi ${BAI_SHORT[k] ?? k}`}
              </Chip>
            ))}
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={!plan.length} onClick={() => start()}>
            Bắt đầu {prefs.min} phút
          </button>
          <span className="hint">
            {plan.length ? `${plan.length} mục · ${countBy(plan)}` : 'Không còn mục đến hạn hay câu sai trong phạm vi đã chọn.'}
          </span>
        </div>
      </div>

      <EnglishHome onStart={setEn} />
    </section>
  );
}

function Session({ list, t0, minutes, onFinish }: { list: TrItem[]; t0: number; minutes: number; onFinish: (r: Result[], secs: number) => void }) {
  const p = useProgress();
  const [i, setI] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const results = useRef<Result[]>([]);
  const graded = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [i]);

  const it = list[i];
  const finish = () => onFinish(results.current, Math.round((Date.now() - t0) / 1000));
  const secs = Math.max(0, Math.floor((now - t0) / 1000));
  if (!it) return null;

  return (
    <section className="stack" aria-label="Phiên ôn">
      <div className="sess-top">
        <span className="num" data-testid="sess-count">
          {i + 1}/{list.length}
        </span>
        <div
          className="bar"
          role="progressbar"
          aria-label="Tiến độ phiên"
          aria-valuemin={0}
          aria-valuemax={list.length}
          aria-valuenow={i}
        >
          <i style={{ width: `${(i / list.length) * 100}%` }} />
        </div>
        <span className="num sess-time">
          {mmss(secs)}
          <span className="sess-total"> / {minutes}:00</span>
        </span>
        <button type="button" className="btn ghost small" onClick={finish}>
          Kết thúc
        </button>
      </div>
      <TrCard
        key={i}
        it={it}
        state={p.stateOf(it.id)}
        note={it.type === 'open' ? p.note(it.id) : ''}
        onSaveNote={(text) => p.setNote(it.id, text)}
        onGrade={(g) => {
          if (graded.current) return;
          graded.current = true;
          p.grade(it.id, g);
          results.current.push({ it, g });
        }}
        onNext={() => {
          graded.current = false;
          if (i + 1 >= list.length) finish();
          else setI(i + 1);
        }}
      />
    </section>
  );
}

function ResultView({ results, secs, onMore, onHome }: { results: Result[]; secs: number; onMore: () => void; onHome: () => void }) {
  const n = results.length;
  const ok = results.filter((r) => r.g === 2).length;
  const wrong = results.filter((r) => r.g === 0);
  return (
    <section className="stack" aria-labelledby="h-result">
      <div className="panel stack">
        <h1 id="h-result" className="h-page">
          {n ? 'Xong phiên ôn hôm nay' : 'Phiên ôn chưa có câu trả lời'}
        </h1>
        <div className="stats">
          <div className="stat">
            <b className="num">{n}</b>
            <span>mục đã ôn</span>
          </div>
          <div className="stat">
            <b className="num">{n ? `${fmt((ok / n) * 100)}%` : '–'}</b>
            <span>nhớ rõ / làm đúng</span>
          </div>
          <div className="stat">
            <b className="num">
              {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
            </b>
            <span>thời gian</span>
          </div>
        </div>
        <p className="hint">
          {wrong.length
            ? `${wrong.length} mục quên hoặc sai được xếp lịch ôn lại ngay trong phiên sau.`
            : 'Không có mục nào sai. Các mục nhớ rõ được giãn lịch ôn.'}
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={onMore}>
            Ôn thêm 5 phút
          </button>
          <button type="button" className="btn ghost" onClick={onHome}>
            Về trang Hôm nay
          </button>
        </div>
      </div>
      {wrong.length > 0 && (
        <>
          <div className="eyebrow">Xem lại mục quên / sai</div>
          <div className="results">
            {wrong.map((r, k) => (
              <details key={k} className="item">
                <summary>
                  <b>{titleOf(r.it)}</b>
                </summary>
                <div className="body">
                  <Explain it={r.it} />
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
