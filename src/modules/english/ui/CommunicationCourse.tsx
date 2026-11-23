import { liveQuery } from 'dexie';
import { db } from '../../../core/db';
import { useEffect, useMemo, useState } from 'react';
import { dayKey } from '../../../core/date';
import { levelOf, type Grade } from '../../../core/leitner';
import { LessonReminder } from '../../../ui/components/LessonReminder';
import { useFocusOnMount } from '../../../ui/useFocusOnMount';
import { useProgress } from '../../../ui/useProgress';
import { communicationHome, communicationHref, communicationKey, latestComparison, learningPath, sessions, topics, type CommunicationLesson } from '../communication';
import { tts } from '../tts';
import { useTtsLifecycle } from '../useTts';
import { TopicRecorder } from './TopicScreen';
import type { SpeakingTopic } from '../speech/topics';
import { SayCheck } from './SayCheck';
import { SpeakButton } from './SpeakButton';

function usePath() {
  const p = useProgress();
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    const refresh = () => setToday(dayKey());
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer); };
  }, []);
  return { ...learningPath(p.stateOf, today), loaded: p.loaded };
}

function SkillComparison() {
  const [change, setChange] = useState<ReturnType<typeof latestComparison>>();
  useEffect(() => {
    const query = liveQuery(() => db.reviews.where('itemId').anyOf(sessions.map((l) => communicationKey(l.id))).toArray())
      .subscribe({ next: (logs) => setChange(latestComparison(logs)), error: () => setChange(undefined) });
    return () => query.unsubscribe();
  }, []);
  if (!change) return <p className="hint">Luyện lại cùng một buổi vào ngày khác để so sánh hai lần gần nhất.</p>;
  const labels = ['cần ôn', 'cần gợi ý', 'tự vận dụng'];
  return <p><strong>{change.lesson.title}</strong> · {change.previous.day.split('-').reverse().join('/')} đạt mức “{labels[change.previous.grade]}”, {change.last.day.split('-').reverse().join('/')} đạt mức “{labels[change.last.grade]}”.</p>;
}

export function CommunicationSummary({ assessment = false }: { assessment?: boolean }) {
  const path = usePath();
  return <section className="panel stack comm-summary" aria-label="Giao tiếp công sở">
    <h2 className="h-sec">{assessment ? 'Phát triển kỹ năng giao tiếp' : 'Giao tiếp công sở'}</h2>
    {path.loaded && <>
      <p>{path.practiced}/{sessions.length} buổi đã luyện · {path.due.length} buổi đến hạn ôn</p>
      {assessment && <>
        <ul className="comm-counts">{topics.map((t) => {
          const group = path.rows.filter((r) => r.lesson.topic === t);
          return <li key={t}><strong>{t}</strong><span>{group.filter((r) => r.state).length}/{group.length} đã luyện · {group.filter((r) => levelOf(r.state) === 2).length} nhớ vững</span></li>;
        })}</ul>
        <SkillComparison />
        <p className="hint">“Nhớ vững” là buổi đã lên hộp ôn 4 qua nhiều lần tự luyện. Mức này phản ánh khả năng nhớ bài theo tự đánh giá.</p>
      </>}
      {path.next?.state && <p><strong>Thử nhớ lại</strong> · {path.next.lesson.recall}</p>}
      {path.next ? <div className="row"><a className="btn roadmap-link" href={communicationHref(path.next.lesson.id)}>
        {path.next.state ? 'Ôn lại' : 'Luyện'} · {path.next.lesson.title}</a></div>
        : path.nextDate && <p>Buổi ôn tiếp theo vào {path.nextDate.split('-').reverse().join('/')}.</p>}
    </>}
    <div className="row"><a className="btn ghost roadmap-link" href={communicationHome}>Xem lộ trình giao tiếp</a></div>
  </section>;
}

export function CommunicationCourse({ id }: { id: string }) {
  const path = usePath();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const lesson = sessions.find((l) => l.id === id);
  if (lesson) return <Practice key={id} lesson={lesson} />;
  return <section className="stack" aria-labelledby="communication-title">
    <header className="panel stack comm-intro">
      <h1 className="h-page" tabIndex={-1} ref={heading} id="communication-title">Lộ trình giao tiếp công sở</h1>
      <p>Sáu tình huống đi từ bắt chuyện đến phản biện và trình bày đề xuất. Mỗi buổi, bạn chọn lời đáp, luyện nói rồi tự đánh giá theo hai tiêu chí.</p>
      {path.loaded && <p>{path.practiced}/{sessions.length} buổi đã luyện · {path.retained} buổi nhớ vững</p>}
      <div className="row"><a className="btn ghost roadmap-link" href="#lo-trinh">Lộ trình Total Rewards</a></div>
    </header>
    {topics.map((topic, index) => <section key={topic} className="panel stack">
      <h2 className="h-sec">Chặng {index + 1} · {topic}</h2>
      <ol className="comm-lessons">{path.rows.filter((r) => r.lesson.topic === topic).map(({ lesson: l, state }) =>
        <li key={l.id}><a className="comm-lesson" href={communicationHref(l.id)}>
          <strong>{l.title}</strong><span>{!path.loaded ? 'Đang đọc tiến độ…' : !state ? 'Chưa luyện' : path.due.some((r) => r.lesson.id === l.id) ? 'Đến hạn ôn' : 'Ôn lại ngày ' + state.due.split('-').reverse().join('/')}</span>
        </a></li>)}</ol>
    </section>)}
  </section>;
}

function Practice({ lesson }: { lesson: CommunicationLesson }) {
  const p = useProgress();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  useTtsLifecycle();
  useEffect(() => { p.touch(); window.scrollTo(0, 0); }, [p]);
  const [choice, setChoice] = useState<number>();
  const [tool, setTool] = useState<'model' | 'recorder'>();
  const topic = useMemo<SpeakingTopic>(() => ({
    id: lesson.id, en: lesson.speakingPrompt, vi: lesson.task, hints: lesson.hints,
    topic: lesson.topic === 'Small talk' ? 'office' : 'meetings', level: lesson.topic === 'Small talk' ? 'B1' : 'B2',
  }), [lesson]);
  const [criteria, setCriteria] = useState([false, false]);
  const [result, setResult] = useState<{ due: string; early: boolean }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const feedback = useFocusOnMount<HTMLHeadingElement>(choice !== undefined && !result);
  const completion = useFocusOnMount<HTMLHeadingElement>(!!result);
  const key = communicationKey(lesson.id);

  async function finish() {
    if (saving || choice === undefined || !p.loaded) return;
    setSaving(true);
    setError(false);
    const prev = p.stateOf(key);
    const early = !!prev && prev.due > p.today();
    const count = criteria.filter(Boolean).length;
    const grade: Grade = count === 0 ? 0 : count === 2 && choice === lesson.correct ? 2 : 1;
    const state = early ? prev : p.grade(key, grade, { speak: true });
    await p.flush();
    setSaving(false);
    if (p.problem) setError(true);
    setResult({ due: state.due, early });
  }

  return <article className="panel stack comm-reader" aria-labelledby="comm-lesson-title">
    <div className="row"><a className="btn ghost roadmap-link" href={communicationHome}>Về lộ trình giao tiếp</a></div>
    <header><p className="eyebrow">{lesson.topic} · Buổi {sessions.indexOf(lesson) + 1}/{sessions.length}</p>
      <h1 className="h-page" tabIndex={-1} ref={heading} id="comm-lesson-title">{lesson.title}</h1></header>
    {result ? <>
      <h2 className="h-sec" tabIndex={-1} ref={completion}>Kết quả buổi luyện</h2>
      <p>{choice === lesson.correct ? 'Bạn đã chọn lời đáp phù hợp.' : 'Hãy đọc lại lý do chọn lời đáp mẫu.'} Tự đánh giá phần nói đạt {criteria.filter(Boolean).length}/2 tiêu chí.</p>
      <p>{result.early ? 'Bạn vừa luyện thêm trước hạn. Lịch ôn vẫn là' : 'Hẹn ôn lại'} {result.due.split('-').reverse().join('/')}.</p>
      {error && <p role="alert">Bộ nhớ trên máy gặp lỗi. Kết quả của lượt này có thể chỉ giữ được khi app còn mở.</p>}
      <LessonReminder id={lesson.id} title={lesson.title} prompt={lesson.recall} href={communicationHref(lesson.id)} />
      <div className="row"><a className="btn roadmap-link" href="#hom-nay">Xem buổi được gợi ý</a>
        <a className="btn ghost roadmap-link" href="#tien-do">Xem tiến độ kỹ năng</a></div>
    </> : <>
      <p>{lesson.scene}</p>
      <div className="stack comm-cue"><p lang="en">{lesson.cue}</p>
        <details><summary>Xem nghĩa câu mở đầu</summary><p>{lesson.vi}</p></details>
        <div className="row"><SpeakButton text={lesson.cue} label="Nghe câu mở đầu" /></div></div>
      {choice === undefined ? <section className="stack">
        <h2 className="h-sec">Bạn sẽ đáp thế nào?</h2>
        {lesson.options.map((option, i) => <button type="button" lang="en" className="btn ghost comm-option" key={option} onClick={() => setChoice(i)}>{option}</button>)}
      </section> : <>
        <section className="stack"><h2 className="h-sec" ref={feedback} tabIndex={-1}>Đối chiếu lời đáp</h2>
          <p lang="en">{lesson.options[choice]}</p><p>{lesson.feedback[choice]}</p>
          {choice !== lesson.correct && <p>Lời đáp gợi ý · <span lang="en">{lesson.options[lesson.correct]}</span></p>}
        </section>
        <section className="stack"><h2 className="h-sec">Luyện nói bằng lời của bạn</h2><p>{lesson.task}</p>
          <div className="row">
            <button type="button" className="btn ghost" aria-expanded={tool === 'model'} onClick={() => { tts.cancel(); setTool(tool === 'model' ? undefined : 'model'); }}>Luyện câu mẫu</button>
            <button type="button" className="btn ghost" aria-expanded={tool === 'recorder'} onClick={() => { tts.cancel(); setTool(tool === 'recorder' ? undefined : 'recorder'); }}>Ghi và nghe lại câu trả lời</button>
          </div>
          {tool === 'model' && <div className="stack"><p lang="en">{lesson.model}</p><p>{lesson.meaning}</p><SayCheck target={lesson.model} /></div>}
          {tool === 'recorder' && <TopicRecorder topic={topic} />}
        </section>
        <fieldset className="checkpoint-question"><legend>Sau khi nói, đánh dấu điều bạn làm được</legend>
          {lesson.criteria.map((criterion, i) => <label key={criterion}><input type="checkbox" checked={criteria[i]} onChange={(e) =>
            setCriteria(criteria.map((old, k) => k === i ? e.target.checked : old))} />{criterion}</label>)}
        </fieldset>
        <p className="hint">Nếu cả hai kỹ năng còn khó, để trống và hẹn ôn lại ngay. Điểm khớp từ khi luyện câu mẫu chỉ dùng để đối chiếu câu đó.</p>
        <div className="row"><button type="button" className="btn" disabled={saving || !p.loaded} onClick={() => void finish()}>Hoàn thành lượt luyện</button></div>
      </>}
    </>}
  </article>;
}
