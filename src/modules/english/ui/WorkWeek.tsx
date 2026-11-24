import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';
import { dayKey } from '../../../core/date';
import { db, setSetting } from '../../../core/db';
import { weekStart } from '../../../core/studytime';
import { finishWorkTurn, openWorkTurn, weeklyChoiceKey, type WorkTurn } from '../../../core/workWeek';
import { weekLabel } from '../../progress/week';
import { useInSessionMark } from '../../../ui/activeSession';
import { LessonReminder } from '../../../ui/components/LessonReminder';
import { StoredMemo } from '../../../ui/components/ReadingMemos';
import { useFocusOnMount } from '../../../ui/useFocusOnMount';
import { useProgress } from '../../../ui/useProgress';
import { useTtsLifecycle } from '../useTts';
import { type WorkTopic, workTopics, workHref } from '../workTopics';
import type { SpeakingTopic } from '../speech/topics';
import { TopicRecorder } from './TopicScreen';
import { SpeakButton } from './SpeakButton';

export function WorkWeekCard() {
  const [choice, setChoice] = useState<string | null>();
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState(() => dayKey());
  const active = workTopics.find(t => t.id === choice);
  useEffect(() => {
    const sub = liveQuery(() => db.settings.get(weeklyChoiceKey)).subscribe({
      next: row => setChoice(typeof row?.value === 'string' ? row.value : ''), error: () => setChoice(null),
    });
    const refresh = () => setToday(dayKey());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { sub.unsubscribe(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  async function choose(id: string) {
    setError(false); setSaving(true);
    try { await setSetting(weeklyChoiceKey, id); }
    catch { setError(true); }
    finally { setSaving(false); }
  }
  return <section className="stack work-week" aria-labelledby="week-topic-title">
    <h2 className="h-sec" id="week-topic-title">Tình huống trong tuần</h2>
    <p className="hint">Tuần {weekLabel(weekStart(today))}</p>
    {choice === undefined ? <p role="status">Đang mở tình huống…</p> : choice === null ? <p role="alert">Chưa đọc được lựa chọn trên máy.</p> : <>
      {active && <><p><strong>{active.title}</strong></p><div className="row">
        <a className="btn roadmap-link" href={workHref(active.id)}>Luyện một câu · 2 phút</a>
        <a className="btn ghost roadmap-link" href={'#doc-them?bai=' + active.id}>Đọc cả tình huống</a></div></>}
      <details key={choice}><summary>{active ? 'Đổi tình huống' : 'Chọn tình huống tuần này'}</summary>
        <div className="stack">{workTopics.map(t =>
          <button className="btn ghost" type="button" key={t.id} disabled={saving} aria-pressed={t.id === choice}
            onClick={() => void choose(t.id)}>{t.title}</button>)}</div>
      </details>
      {error && <p role="alert">Chưa lưu được lựa chọn. Hãy chọn lại.</p>}
    </>}
  </section>;
}

export function WorkWeekPractice({ topic }: { topic: WorkTopic }) {
  const [turn, setTurn] = useState<WorkTurn | null>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    void openWorkTurn(topic.id, topic.lines.length).then(value => { if (live) setTurn(value); }, () => { if (live) setTurn(null); });
    return () => { live = false; };
  }, [topic, retry]);
  if (!turn) return <section className="panel stack"><a className="reading-result-link" href="#hom-nay">Về Hôm nay</a>
    {turn === null ? <><p role="alert">Chưa mở được lượt luyện trên máy.</p>
      <button className="btn ghost" onClick={() => setRetry(n => n + 1)}>Thử lại</button></> : <p role="status">Đang mở câu hỏi…</p>}</section>;
  return <WorkAnswer topic={topic} turn={turn} />;
}

function WorkAnswer({ topic, turn }: { topic: WorkTopic; turn: WorkTurn }) {
  const line = topic.lines[turn.index]!;
  const [openedAt] = useState(Date.now);
  const [record, setRecord] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<number>();
  const p = useProgress();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const feedback = useFocusOnMount<HTMLHeadingElement>(result !== undefined);
  useInSessionMark(result === undefined);
  useTtsLifecycle();
  const speaking = useMemo<SpeakingTopic>(() => ({
    id: turn.id, en: line.cue, vi: line.task, topic: 'office', level: 'B2', seconds: 30, hints: [],
  }), [turn.id, line]);
  async function finish(grade: 1 | 2) {
    if (saving || micBusy) return;
    setSaving(true); setFailed(false);
    try {
      await p.flush();
      const saved = await finishWorkTurn(topic.id, turn, grade, openedAt);
      await p.load(true);
      setResult(saved);
    } catch { setFailed(true); }
    finally { setSaving(false); }
  }
  return <section className="panel stack comm-reader work-week" aria-labelledby="work-title">
    <div><a className="btn ghost roadmap-link" href="#hom-nay">Về Hôm nay</a></div>
    <header><p className="eyebrow">{turn.index === topic.lines.length - 1 ? 'Vận dụng với dữ kiện mới' : 'Lượt ' + (turn.index + 1)} · 2 phút</p>
      <h1 id="work-title" ref={heading} tabIndex={-1} className="h-page">{topic.title}</h1></header>
    <div className="stack comm-cue"><p lang="en">{line.cue}</p>
      <details><summary>Xem nghĩa lời đồng nghiệp</summary><p>{line.cueVi}</p></details>
      <div><SpeakButton text={line.cue} label="Nghe lời đồng nghiệp" /></div></div>
    {result === undefined ? <>
      <p>{line.task}</p>
      <details><summary>Viết câu trả lời hoặc memo</summary>
        <StoredMemo id={turn.id} title="Memo của lượt này" prompt="Ghi câu bạn vừa nói hoặc chỗ còn vướng." /></details>
      {record ? <TopicRecorder topic={speaking} localOnly onBusyChange={setMicBusy} />
        : <div><button className="btn ghost" onClick={() => setRecord(true)}>Mở ghi âm (tùy chọn)</button></div>}
      <fieldset className="checkpoint-question"><legend>Kết thúc sau một câu</legend>
        <div className="row"><button className="btn" disabled={saving || micBusy} onClick={() => void finish(2)}>Tôi đã tự trả lời</button>
          <button className="btn ghost" disabled={saving || micBusy} onClick={() => void finish(1)}>Tôi cần gợi ý</button></div>
      </fieldset>
      {failed && <p role="alert">Chưa lưu được lượt luyện. Bạn có thể thử lại hoặc mở lại từ Hôm nay.</p>}
    </> : <>
      <h2 className="h-sec" ref={feedback} tabIndex={-1}>Đã lưu lượt luyện</h2>
      <p>Bạn tự đánh giá · {result === 2 ? 'Đã tự trả lời' : 'Cần gợi ý'}</p>
      <h3>Một cách trả lời</h3><p lang="en">{line.model}</p><p>{line.meaning}</p>
      <p><strong>Tự kiểm</strong> · {line.check}</p>
      <div className="row"><a className="btn roadmap-link" href="#hom-nay">Xong · Về Hôm nay</a>
        <a className="btn ghost roadmap-link" href={'#doc-them?bai=' + topic.id}>Đọc cả tình huống</a></div>
      <LessonReminder id={'tuan-' + topic.id} title={topic.title} prompt="Nói một câu bằng lời của bạn trước khi mở gợi ý." href={workHref(topic.id)} />
    </>}
  </section>;
}
