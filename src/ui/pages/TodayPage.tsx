import { WorkWeekCard, WorkWeekPractice } from '../../modules/english/ui/WorkWeek';
import { workTopics } from '../../modules/english/workTopics';
import { useLocationHash } from '../useHashRoute';
import { CommunicationSummary } from '../../modules/english/ui/CommunicationCourse';
import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { capstoneHref } from '../../modules/tr/Capstone';
import { caseDraftKeys, draftEnvelope, readEquity, readOffers } from '../../core/caseDraft';
import { equityHref } from '../../modules/tr/PayEquityCase';
import { offerHref } from '../../modules/tr/OfferCase';
import { draftKey, readDraft } from '../../modules/tr/capstoneDraft';
import { db, getSetting, setSetting } from '../../core/db';
import type { Grade } from '../../core/leitner';
import { fmt } from '../../core/num';
import { RangeBar } from '../components/RangeBar';
import { GoalBar } from '../components/GoalBar';
import { BackupNudge } from '../components/BackupNudge';
import { useProgress } from '../useProgress';
import { BAI_KEYS, BAI_SHORT } from '../../modules/tr/data';
import { titleOf, type TrItem } from '../../modules/tr/items';
import { DEFAULT_PREFS, DURATIONS, MODES, TIME, countBy, homeStats, modeOf, planSession, type Prefs } from '../../modules/tr/plan';
import { SkillDrills } from '../../modules/tr/SkillDrills';
import { CourseRecommendation } from '../../modules/tr/CourseReview';
import { courseProgress, useRoadmapProgress } from '../../modules/tr/roadmap';
import { useRoadmapReview } from '../../modules/tr/roadmapCards';
import { Explain, TrCard } from '../../modules/tr/cards/TrCard';
import { EnglishHome } from '../../modules/english/ui/EnglishHome';
import { EnglishScreen, type EnView } from '../../modules/english/ui/EnglishScreen';
import { DailyPanel } from '../mix/DailyPanel';
import { WeakPanel } from '../mix/WeakPanel';
import { planToday } from '../mix/planToday';
import { DailySession } from '../mix/DailySession';
import { DailyResultView } from '../mix/DailyResultView';
import { useDailyPrefs } from '../useDailyPrefs';
import type { DailyEntry } from '../../modules/mix/plan';
import type { DailyResult } from '../../modules/mix/result';
import { beginSession, endSession, stepSession, useInSessionMark } from '../activeSession';
import { ResumePanel } from '../mix/ResumePanel';
import { resolveActive, type Resumable } from '../mix/resumeTarget';
import { clearActive, loadActive } from '../../core/resume';
import { lessonHref } from '../routes';

const PREFS_KEY = 'tr.prefs';

interface Result {
  it: TrItem;
  g: Grade;
}
type View =
  | { kind: 'home' }
  | { kind: 'session'; list: TrItem[]; t0: number; minutes?: number; pos?: number; done?: Result[] }
  | { kind: 'result'; results: Result[]; secs: number }
  | { kind: 'mix'; weak?: boolean; entries: DailyEntry[]; t0: number; minutes: number; pos?: number; done?: DailyResult[] }
  | { kind: 'mix-result'; weak?: boolean; results: DailyResult[]; secs: number };

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

export function TodayPage() {
  const params = new URLSearchParams(useLocationHash().split('?')[1]);
  const topic = workTopics.find(t => t.id === params.get('tinh-huong'));
  return topic ? <WorkWeekPractice key={topic.id} topic={topic} /> : <TodayHome />;
}

function TodayHome() {
  const p = useProgress();
  const readingReview = useRoadmapReview(p);
  const readingProgress = useRoadmapProgress();
  const daily = useDailyPrefs();
  const [drafts, setDrafts] = useState({ capstone: false, equity: false, offers: false });
  useEffect(() => {
    const sub = liveQuery(() => db.settings.bulkGet([draftKey, caseDraftKeys.equity, caseDraftKeys.offers])).subscribe({
      next: ([capstone, equity, offers]) => setDrafts({
        capstone: !!readDraft(capstone?.value), equity: !!readEquity(draftEnvelope(equity?.value)?.fields),
        offers: !!readOffers(draftEnvelope(offers?.value)?.fields),
      }), error: () => setDrafts({ capstone: false, equity: false, offers: false }),
    });
    return () => sub.unsubscribe();
  }, []);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [en, setEnView] = useState<EnView | null>(null);
  const [resume, setResume] = useState<Resumable | null>(null);
  const setEn = (v: EnView | null) => {
    if (v) setResume(null);
    setEnView(v);
  };

  // Phiên dở (iOS tắt app khi chạy nền): hiện khối "Tiếp tục" nếu chưa quá 12 giờ.
  useEffect(() => {
    let live = true;
    void loadActive(Date.now())
      .then((s) => {
        if (!live || !s) return;
        const r = resolveActive(s, Date.now());
        if (r) setResume(r);
        else void clearActive().catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const continueResume = () => {
    if (!resume) return;
    const t = resume.target;
    setResume(null);
    if (t.kind === 'mix') setView({ kind: 'mix', ...(t.weak ? { weak: true } : {}), entries: t.entries, t0: t.t0, minutes: t.minutes, pos: t.pos, done: t.results });
    else if (t.kind === 'tr') setView({ kind: 'session', list: t.list, t0: t.t0, minutes: t.minutes, pos: t.pos, done: t.results });
    else setEnView(t.view);
  };
  const dropResume = () => {
    setResume(null);
    void clearActive().catch(() => undefined);
  };

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
    if (!list.length) return;
    setResume(null);
    setView({ kind: 'session', list, t0: Date.now() });
  };

  const startMix = (minutes: number, entries: DailyEntry[] = planToday(p, daily, minutes).entries) => {
    if (!entries.length) return;
    setResume(null);
    setView({ kind: 'mix', entries, t0: Date.now(), minutes });
  };

  const startWeak = (entries: DailyEntry[]) => {
    if (!entries.length) return;
    setResume(null);
    const minutes = Math.max(1, Math.round(entries.reduce((a, e) => a + e.secs, 0) / 60));
    setView({ kind: 'mix', weak: true, entries, t0: Date.now(), minutes });
  };

  if (en) return <EnglishScreen view={en} onExit={() => setEn(null)} />;
  if (view.kind === 'mix') {
    return (
      <DailySession
        kind={view.weak ? 'weak' : 'mix'}
        entries={view.entries}
        t0={view.t0}
        minutes={view.minutes}
        {...(view.pos !== undefined ? { start: view.pos } : {})}
        {...(view.done ? { initial: view.done } : {})}
        onFinish={(results, secs) => {
          if (results.length) p.addSeconds(secs);
          setView({ kind: 'mix-result', ...(view.weak ? { weak: true } : {}), results, secs });
        }}
      />
    );
  }
  if (view.kind === 'mix-result') {
    return (
      <DailyResultView
        results={view.results}
        secs={view.secs}
        {...(view.weak ? { title: 'Xong phiên ôn điểm yếu' } : { onMore: () => startMix(5) })}
        onHome={() => setView({ kind: 'home' })}
      />
    );
  }
  if (view.kind === 'session') {
    return (
      <Session
        list={view.list}
        t0={view.t0}
        minutes={view.minutes ?? prefs.min}
        {...(view.pos !== undefined ? { start: view.pos } : {})}
        {...(view.done ? { initial: view.done } : {})}
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
  const course = readingProgress && courseProgress(readingProgress);

  return (
    <section className="stack">
      <section className="panel stack study-hub" aria-labelledby="h-today">
        <header><h1 className="h-page" id="h-today">Trung tâm học tập</h1>
          {course && <p className="hint">{course.count}/{course.total} bài Total Rewards đã hoàn thành</p>}</header>
        {resume && <ResumePanel done={resume.done} total={resume.total} onResume={continueResume} onDrop={dropResume} />}
        {drafts.capstone && <a className="btn roadmap-link" href={capstoneHref}>Tiếp tục đề xuất giữ người</a>}
        {drafts.equity && <a className="btn roadmap-link" href={equityHref}>Tiếp tục phiếu công bằng lương</a>}
        {drafts.offers && <a className="btn roadmap-link" href={offerHref}>Tiếp tục so sánh thư mời</a>}
        <SkillDrills>
        {course?.next ? (
          <div className="row">
            <a className="btn roadmap-link" href={lessonHref(course.next.lesson.id)}>
              {course.count ? 'Học tiếp' : 'Bắt đầu'} {course.next.code} · {course.next.lesson.title}
            </a>
          </div>
        ) : course && <><p className="hint">Đã hoàn thành {course.total} bài trong lộ trình</p><CourseRecommendation /></>}
        </SkillDrills>
        <WorkWeekCard />
        <nav className="hub-library" aria-label="Thư viện học tập">
          <a href="#doc-them">Bài đọc song ngữ</a><a href="#tra-cuu">Tra cứu thuật ngữ</a>
          <a href="#lo-trinh?memo=1">Sổ memo</a><a href="#tien-do">Xem tiến độ</a>
        </nav>
        <div className="row">
          <a className="btn ghost roadmap-link" href="#lo-trinh">Mở lộ trình Total Rewards</a>
          {!!readingReview?.length && (
            <button type="button" className="btn" onClick={() => {
              setResume(null);
              const seconds = readingReview.reduce((sum, item) => sum + TIME[item.type], 0);
              setView({ kind: 'session', list: readingReview, t0: Date.now(), minutes: Math.ceil(seconds / 60) });
            }}>
              Ôn {readingReview.length} thẻ từ bài đọc
            </button>
          )}
        </div>
      </section>
      <DailyPanel onStart={(plan, minutes) => startMix(minutes, plan.entries)} />
      <CommunicationSummary />
      <GoalBar p={p} prefs={daily} />
      <WeakPanel onStart={startWeak} />
      <BackupNudge />

      <div className="panel stack">
        <div>
          <RangeBar value={st.pen} />
          <p className="hint" style={{ marginTop: 8 }}>
            Mục đã nhớ vững <span className="num">{fmt(st.pen * 100, 1)}%</span> · {st.learned}/{st.tracked} mục đã
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

      <div className="panel stack" aria-labelledby="h-tr">
        <div>
          <div className="eyebrow">Ôn riêng</div>
          <h2 id="h-tr" className="h-page">
            Total Rewards
          </h2>
        </div>
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

function Session({
  list,
  t0,
  minutes,
  onFinish,
  start = 0,
  initial,
}: {
  list: TrItem[];
  t0: number;
  minutes: number;
  onFinish: (r: Result[], secs: number) => void;
  start?: number;
  initial?: Result[];
}) {
  useInSessionMark();
  const p = useProgress();
  const [i, setI] = useState(start);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const results = useRef<Result[]>(initial ?? []);
  const savedStep = useRef<Promise<unknown> | null>(null);
  const advancing = useRef(false);

  useEffect(() => {
    const saved = results.current.map((r) => ({ i: list.indexOf(r.it), g: r.g })).filter((r) => r.i >= 0);
    beginSession('tr', list.map((x) => ({ id: x.id })), t0, minutes, start, saved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    savedStep.current = null;
    advancing.current = false;
    window.scrollTo?.({ top: 0 });
  }, [i]);

  const it = list[i];
  const finish = async () => {
    if (advancing.current) return;
    advancing.current = true;
    setSaving(true);
    await Promise.all([savedStep.current, endSession()]);
    onFinish(results.current, Math.round((Date.now() - t0) / 1000));
  };
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
        <button type="button" className="btn ghost small" disabled={saving} onClick={finish}>
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
          if (advancing.current || savedStep.current) return;
          p.grade(it.id, g);
          results.current.push({ it, g });
          savedStep.current = Promise.all([p.flush(), stepSession(i + 1, { i, g })]);
        }}
        onNext={async () => {
          if (advancing.current) return;
          if (i + 1 >= list.length) return finish();
          advancing.current = true;
          setSaving(true);
          await (savedStep.current ?? stepSession(i + 1));
          setI(i + 1);
          setSaving(false);
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
