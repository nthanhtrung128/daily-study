import { TransferPractice } from './TransferPractice';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import checkpoints from '../../../content/tr-roadmap/checkpoints.json';
import { COURSE_REVIEW_PREFIX, readAttempt, reviewPlan, saveCourseReview, type Attempt } from '../../core/courseReview';
import { dayKey } from '../../core/date';
import { db } from '../../core/db';
import { lessonHref, reviewHref } from '../../ui/routes';
import { useFocusOnMount } from '../../ui/useFocusOnMount';
import { useProgress } from '../../ui/useProgress';
import { ROADMAP_MODULES } from './roadmap';

type Checkpoint = typeof checkpoints.M01;
const content: Readonly<Record<string, Checkpoint>> = checkpoints;
const codes = ROADMAP_MODULES.map((module) => module.code);
const titles = new Map(ROADMAP_MODULES.flatMap((module) => module.lessons.map((lesson) => [lesson.id, lesson.title] as const)));
const moduleTitle = (code: string) => ROADMAP_MODULES.find((module) => module.code === code)?.title;
const formatDay = (key: string) => new Date(key + 'T12:00:00').toLocaleDateString('vi-VN');

function useReviewSchedule() {
  const [attempts, setAttempts] = useState<Map<string, Attempt> | null>();
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    const subscription = liveQuery(() => db.settings.where('key').startsWith(COURSE_REVIEW_PREFIX).toArray()).subscribe({
      next: (rows) => setAttempts(new Map(rows.flatMap((row) => {
        const attempt = readAttempt(row.value);
        return attempt ? [[row.key.slice(COURSE_REVIEW_PREFIX.length), attempt] as const] : [];
      }))),
      error: () => setAttempts(null),
    });
    const update = () => setToday(dayKey());
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      subscription.unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return { attempts, today };
}

export function CourseRecommendation() {
  const { attempts, today } = useReviewSchedule();
  if (!attempts) return <p role="status">{attempts === null ? 'Chưa đọc được lịch ôn trên máy.' : 'Đang đọc lịch ôn…'}</p>;
  const { next, nextDate } = reviewPlan(codes, attempts, today);
  return <div className="stack">
    <h2 className="h-sec">Ôn duy trì sau khóa</h2>
    {next ? <>
      <p>{attempts.has(next) ? 'Buổi đã đến hạn ôn.' : 'Buổi này chưa có lượt tự kiểm tra.'} Trả lời hai câu hỏi và giải một tình huống để xác định lần ôn tiếp theo.</p>
      <div className="row"><a className="btn roadmap-link" href={reviewHref(next)}>Ôn {next} · {moduleTitle(next)}</a></div>
    </> : nextDate && <p>Bạn đã ôn hết các buổi đến hạn. Lần ôn tiếp theo vào {formatDay(nextDate)}.</p>}
    <TransferPractice today={today} />
  </div>;
}

export function CourseReview({ code, graduated }: { code: string; graduated: boolean }) {
  const { attempts, today } = useReviewSchedule();
  const data = content[code];
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const prev = attempts?.get(code);
  const scheduled = prev && prev.due > today ? prev : undefined;
  return <article className="panel stack roadmap-reader">
    <div className="row"><a className="btn ghost small roadmap-link" href="#lo-trinh">Về lộ trình</a></div>
    <header>
      <p className="eyebrow">{code} · {moduleTitle(code)}</p>
      <h1 className="h-page" tabIndex={-1} ref={heading}>Tự kiểm tra cuối buổi</h1>
    </header>
    {attempts && data ? <ReviewForm key={scheduled?.last ?? 'dang-lam'} code={code} data={data} saved={scheduled} graduated={graduated} />
      : <p role="status">{attempts === null ? 'Chưa đọc được lịch ôn trên máy. Hãy tải lại trang để thử lại.' : 'Đang đọc lịch ôn…'}</p>}
  </article>;
}

function ReviewForm({ code, data, saved, graduated }: {
  code: string; data: Checkpoint; saved: Attempt | undefined; graduated: boolean;
}) {
  const progress = useProgress();
  const [choices, setChoices] = useState([-1, -1]);
  const [response, setResponse] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const answers = saved?.choices ?? choices;
  const correct = data.questions.filter((q, i) => q.correct === answers[i]).length;
  const results = revealed || !!saved;
  const resultHeading = useFocusOnMount<HTMLHeadingElement>(revealed);

  async function record(understood: boolean) {
    setSaving(true);
    setError(false);
    try {
      await progress.flush();
      await saveCourseReview(code, data.questions.map((q) => q.correct), choices, response, understood);
      await progress.load(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (results) return <div className="stack">
    <h2 className="h-sec" ref={resultHeading} tabIndex={-1}>Đúng {correct}/{data.questions.length} câu trắc nghiệm</h2>
    {data.questions.map((q, i) => <section key={q.prompt} className="roadmap-reading">
      <h3>{i + 1}. {q.prompt}</h3>
      <p>Bạn chọn · {q.options[answers[i]!]}</p>
      <p><strong>Đáp án · {q.options[q.correct]}</strong></p>
      <p>{q.explanation}</p>
      {saved && <a href={lessonHref(q.lesson)}>Đọc lại · {titles.get(q.lesson)}</a>}
    </section>)}
    <section className="roadmap-reading">
      <h3>{data.scenario.prompt}</h3>
      <p><strong>Bài làm của bạn</strong> · {saved?.response ?? response}</p>
      <p><strong>Gợi ý đối chiếu</strong> · {data.scenario.answer}</p>
      {saved && <a href={lessonHref(data.scenario.lesson)}>Đọc lại · {titles.get(data.scenario.lesson)}</a>}
    </section>
    {saved ? <>
      <p role="status">Đã lưu trên máy · {saved.understood ? 'Đã giải thích được tình huống' : 'Tình huống cần ôn thêm'}. Ôn lại {code} vào {formatDay(saved.due)}.</p>
      {graduated && <CourseRecommendation />}
    </> : <>
      <p>Bạn có tự giải thích được cách tính hoặc căn cứ quyết định trong tình huống này không? Nếu còn vướng tình huống hoặc sai trắc nghiệm, buổi này sẽ trở lại vào ngày mai.</p>
      <div className="row">
        <button className="btn" disabled={saving} onClick={() => void record(true)}>Đã giải thích được</button>
        <button className="btn ghost" disabled={saving} onClick={() => void record(false)}>Cần ôn thêm</button>
      </div>
      {error && <p role="alert">Chưa lưu được lượt ôn. Hãy thử lại.</p>}
    </>}
  </div>;

  return <form className="stack" onSubmit={(e) => { e.preventDefault(); setRevealed(true); }}>
    <p>Chọn một đáp án cho mỗi câu, rồi viết cách xử lý của bạn trước khi xem lời giải.</p>
    {data.questions.map((q, i) => <fieldset className="checkpoint-question" key={q.prompt}>
      <legend>{i + 1}. {q.prompt}</legend>
      {q.options.map((option, j) => <label key={option}>
        <input type="radio" name={'cau-' + i} required checked={choices[i] === j}
          onChange={() => setChoices((old) => old.map((v, k) => i === k ? j : v))} /> {option}
      </label>)}
    </fieldset>)}
    <label className="field"><strong>Tình huống · {data.scenario.prompt}</strong>
      <textarea required maxLength={2000} value={response} onChange={(e) => setResponse(e.target.value)} />
    </label>
    <div className="row"><button className="btn" disabled={choices.includes(-1) || !response.trim()}>Đối chiếu bài làm</button></div>
  </form>;
}
