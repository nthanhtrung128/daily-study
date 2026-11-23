import { liveQuery } from 'dexie';
import { useEffect, useState, type ReactNode } from 'react';
import { dayKey } from '../../core/date';
import { db } from '../../core/db';
import { drillKeys, drillSchedule, finishDrill, type Drill } from '../../core/skillDrills';
import { useProgress } from '../../ui/useProgress';
import { useFocusOnMount } from '../../ui/useFocusOnMount';
import { drillQuestion, matchesQuestion, skillNames } from './drillQuestions';
import { readAmount } from './raiseBudget';

function sourceLabel(source: string) {
  return source === 'capstone' ? 'bài tổng hợp' : 'bài vận dụng ngày ' + source;
}

export function SkillDrills({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Drill[]>([]);
  const [today, setToday] = useState(dayKey);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const focus = useFocusOnMount<HTMLHeadingElement>(!!feedback);
  useEffect(() => {
    const sub = liveQuery(() => db.settings.bulkGet(drillKeys)).subscribe({
      next: (rows) => { setQueue(drillSchedule(rows)); setError(false); }, error: () => setError(true),
    });
    const update = () => setToday(dayKey());
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => { sub.unsubscribe(); window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  const next = queue[0];
  if (!next && !feedback && !error) return children;
  const panel = <section className="panel stack skill-drills" aria-label="Ôn theo tiêu chí cần luyện">
    <h2 className="h-sec">Ôn theo tiêu chí cần luyện</h2>
    {error && <p role="alert">Chưa đọc được lịch ôn. Hãy tải lại để thử lại.</p>}
    {feedback ? <><h3 ref={focus} tabIndex={-1}>Kết quả lượt ôn</h3><p>{feedback}</p>
      <button className="btn ghost" onClick={() => setFeedback('')}>Xem lịch tiếp theo</button></> : next && <>
      <h3>{skillNames[next.skill]}</h3><p>Từ {sourceLabel(next.source)} · Đến hạn {next.due.split('-').reverse().join('/')}.</p>
      {next.due <= today && <DrillForm key={[next.skill, next.sourceAt, next.index].join('-')} drill={next} onFeedback={setFeedback} />}
    </>}
  </section>;
  return next && next.due <= today || feedback ? <>{panel}{children}</> : <>{children}{panel}</>;
}

function DrillForm({ drill, onFeedback }: { drill: Drill; onFeedback: (message: string) => void }) {
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const progress = useProgress();
  const q = drillQuestion(drill.skill, drill.index);
  const valid = q.choices ? q.choices.includes(answer) : readAmount(answer) !== undefined;
  async function submit() {
    if (!valid || saving) return;
    setSaving(true); setError(false);
    try {
      await progress.flush();
      const correct = matchesQuestion(q, answer);
      const saved = await finishDrill(drill, correct);
      if (saved) await progress.load(true);
      onFeedback(saved ? (correct ? 'Đúng. Đã hoàn thành tiêu chí này. ' : 'Cần luyện thêm. Ngày mai bạn sẽ gặp câu khác. ') + q.why :
        'Lịch đã thay đổi trên thiết bị. Mở lịch tiếp theo để xem câu hiện tại.');
    } catch { setError(true); setSaving(false); }
  }
  return <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
    {q.choices ? <fieldset className="checkpoint-question"><legend>{q.prompt}</legend>
      {q.choices.map((c) => <label key={c}><input type="radio" name="drill-answer" checked={answer === c} onChange={() => setAnswer(c)} />{c}</label>)}</fieldset> :
      <><p>{q.prompt}</p><label className="field">Số tiền (triệu đồng)<input type="text" inputMode="decimal" maxLength={10} value={answer} onChange={(e) => setAnswer(e.target.value)} /></label></>}
    <div className="row"><button className="btn" disabled={saving || !valid}>Đối chiếu câu ôn</button></div>
    {error && <p role="alert">Chưa lưu được lượt ôn. Hãy thử lại.</p>}
  </form>;
}
