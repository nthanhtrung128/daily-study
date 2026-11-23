import { useEffect, useRef, useState } from 'react';
import { fmt } from '../../core/num';
import { compaRatio, rangePenetration } from '../../modules/tr/calc';
import { completeLesson, courseProgress, COURSE_STAGES, nextAfter, ROADMAP_MODULES, useRoadmapProgress, type RoadmapLesson } from '../../modules/tr/roadmap';
import { relatedCardIds } from '../../modules/tr/roadmapCards';
import { SalaryAnalysisPractice } from '../../modules/tr/SalaryAnalysisPractice';
import { CourseRecommendation, CourseReview } from '../../modules/tr/CourseReview';
import { BonusPoolPractice } from '../../modules/tr/BonusPoolPractice';
import { JobEvaluationPractice } from '../../modules/tr/JobEvaluationPractice';
import { MeritPractice } from '../../modules/tr/MeritPractice';
import { useFocusOnMount } from '../useFocusOnMount';
import { useReadingMemos } from '../../modules/tr/readingMemos';
import { LessonMemo, MemoBook } from '../components/ReadingMemos';
import { RoadmapSearch } from '../components/RoadmapSearch';
import { RoadmapRelatedCards } from '../components/RoadmapRelatedCards';
import { lessonHref, reviewHref } from '../routes';
import { CommunicationCourse } from '../../modules/english/ui/CommunicationCourse';
import { communicationHome } from '../../modules/english/communication';
import { LessonReminder } from '../components/LessonReminder';
import { useLocationHash } from '../useHashRoute';

export function RoadmapPage() {
  const completed = useRoadmapProgress();
  const course = completed && courseProgress(completed);
  const [expanded, setExpanded] = useState<string | null>(null);
  const hash = useLocationHash();
  const params = new URLSearchParams(hash.split('?')[1]);
  const id = params.get('bai');
  const review = ROADMAP_MODULES.find((entry) => entry.code === params.get('on'));
  const communication = params.get('giao-tiep');
  const memo = params.get('memo') === '1';
  const notes = useReadingMemos();
  const [memoQuery, setMemoQuery] = useState('');
  const [lessonQuery, setLessonQuery] = useState('');
  const returnResult = useRef<string | null>(null);
  const module = ROADMAP_MODULES.find((entry) => entry.lessons.some((lesson) => lesson.id === id));
  const selected = module?.lessons.find((lesson) => lesson.id === id);
  const heading = useFocusOnMount<HTMLHeadingElement>(!selected && !memo && !review && !communication);

  useEffect(() => {
    if (selected && memo) document.getElementById('lesson-memo-title')?.focus();
    else if (!selected && !memo && returnResult.current) {
      const link = document.getElementById(`result-${returnResult.current}`);
      link?.focus({ preventScroll: true });
      link?.scrollIntoView({ block: 'center' });
      returnResult.current = null;
    } else window.scrollTo(0, 0);
  }, [selected, memo, review]);

  function open(lesson?: RoadmapLesson) {
    if (window.location.hash !== hash) return;
    if (!lesson && module) setExpanded(module.code);
    window.location.assign(lesson ? lessonHref(lesson.id) : '#lo-trinh');
  }

  if (communication) return <CommunicationCourse key={communication} id={communication} />;
  if (review) return <CourseReview key={review.code} code={review.code} graduated={!!course && !course.next} />;

  if (selected && module) {
    const index = module.lessons.findIndex((lesson) => lesson.id === selected.id);
    return (
      <Lesson
        key={selected.id}
        lesson={selected}
        notes={notes}
        fromMemo={memo}
        label={`Buổi ${Number(module.code.slice(1))} · ${module.title} · Bài ${index + 1}/${module.lessons.length}`}
        moduleCode={module.code}
        source={module.source}
        done={completed?.includes(selected.id)}
        following={completed && nextAfter(selected.id, completed)}
        browseNext={module.lessons[index + 1]}
        onBack={() => open()}
        onNext={open}
      />
    );
  }

  if (memo) return <MemoBook notes={notes} query={memoQuery} onQuery={setMemoQuery} />;

  return (
    <section className="stack roadmap-library" aria-labelledby="roadmap-title">
      <header className="panel stack roadmap-intro">
        <h1 className="h-page" id="roadmap-title" tabIndex={-1} ref={heading}>Đọc và tự ôn Total Rewards</h1>
        <p>{ROADMAP_MODULES.length} buổi qua {COURSE_STAGES.length} chặng. Bắt đầu từ chiến lược đãi ngộ, sau đó thiết kế lương thưởng và vận dụng vào các tình huống chuyên sâu.</p>
        {course && (
          <div className="stack">
            <div className="reading-progress-row">
              <label htmlFor="course-progress">{course.count}/{course.total} bài đã hoàn thành trong lộ trình</label>
              <progress id="course-progress" value={course.count} max={course.total} />
            </div>
            {course.next ? (
              <div className="row">
                <a className="btn roadmap-link" href={lessonHref(course.next.lesson.id)}>
                  {course.count ? 'Học tiếp' : 'Bắt đầu'} {course.next.code} · {course.next.lesson.title}
                </a>
              </div>
            ) : <CourseRecommendation />}
          </div>
        )}
        <div className="row">
          <a className="btn ghost roadmap-link" href={communicationHome}>Lộ trình giao tiếp công sở</a>
          <a className="btn ghost roadmap-link" href="#lo-trinh?memo=1">Sổ memo bài học{notes?.length ? ` (${notes.length})` : ''}</a>
        </div>
      </header>
      <RoadmapSearch query={lessonQuery} onQuery={setLessonQuery} completed={completed}
        onOpen={(id) => { returnResult.current = id; }} />
      {!lessonQuery.trim() && COURSE_STAGES.map((stage, stageIndex) => (
        <section key={stage.title} className="panel stack" aria-labelledby={`stage-${stageIndex}`}>
          <header>
            <p className="eyebrow">Chặng {stageIndex + 1}</p>
            <h2 className="h-sec" id={`stage-${stageIndex}`}>{stage.title}</h2>
          </header>
          {stage.modules.map((entry) => {
            const isOpen = expanded === entry.code;
            const count = entry.lessons.filter((lesson) => completed?.includes(lesson.id)).length;
            const next = completed && entry.lessons.find((lesson) => !completed.includes(lesson.id));
            return (
              <section key={entry.code} className="course-session" aria-labelledby={`module-${entry.code}`}>
                <h3>
                  <button className="course-toggle" type="button" aria-expanded={isOpen}
                    aria-controls={`lessons-${entry.code}`} aria-labelledby={`module-${entry.code}`}
                    aria-describedby={`session-${entry.code} status-${entry.code}`} onClick={() => setExpanded(isOpen ? null : entry.code)}>
                    <span>
                      <span className="eyebrow" id={`session-${entry.code}`}>Buổi {Number(entry.code.slice(1))} · {entry.code}</span>
                      <strong id={`module-${entry.code}`}>{entry.title}</strong>
                      <span className="hint" id={`status-${entry.code}`}>
                        {completed ? `${count}/${entry.lessons.length} bài đã hoàn thành` : `${entry.lessons.length} bài`}
                      </span>
                    </span>
                    <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                  </button>
                </h3>
                <div id={`lessons-${entry.code}`} hidden={!isOpen}>
                  {isOpen && (
                    <div className="stack course-session-body">
                      <p>{entry.goal}</p>
                      {next && <div className="row">
                        <button className="btn" type="button" onClick={() => open(next)}>
                          {count ? 'Học tiếp' : 'Bắt đầu học'} · {next.title}
                        </button>
                      </div>}
                      <ol className="roadmap-lessons" aria-label={`Bài học ${entry.code}`}>
                        {entry.lessons.map((lesson) => (
                          <li key={lesson.id}>
                            <button className="btn ghost" type="button" onClick={() => open(lesson)}>
                              {lesson.title}{completed?.includes(lesson.id) ? ' · Đã hoàn thành' : ''}
                            </button>
                          </li>
                        ))}
                      </ol>
                      <div className="row"><a className="btn ghost roadmap-link" href={reviewHref(entry.code)}>Tự kiểm tra {entry.code}</a></div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </section>
      ))}
    </section>
  );
}

function Lesson({ lesson, notes, fromMemo, label, moduleCode, source, done, following, browseNext, onBack, onNext }: {
  lesson: RoadmapLesson;
  notes: ReturnType<typeof useReadingMemos>;
  fromMemo: boolean;
  label: string;
  moduleCode: string;
  source: string;
  done: boolean | undefined;
  following: ReturnType<typeof nextAfter>;
  browseNext: RoadmapLesson | undefined;
  onBack: () => void;
  onNext: (lesson: RoadmapLesson) => void;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>(!fromMemo);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const related = relatedCardIds(lesson.id);

  async function finish() {
    setSaving(true);
    setError(false);
    try {
      await completeLesson(lesson.id);
      if (following) onNext(following.lesson);
      else onBack();
    } catch {
      setSaving(false);
      setError(true);
    }
  }

  return (
    <article className="panel stack roadmap-reader" aria-labelledby="lesson-title">
      <div className="row">
        {fromMemo ? <a className="btn ghost small roadmap-link" href="#lo-trinh?memo=1">Về sổ memo</a>
          : <button className="btn ghost small" type="button" onClick={onBack}>Về kho kiến thức</button>}
        <button className="btn ghost small" type="button" disabled={notes == null}
          onClick={() => document.getElementById('lesson-memo')?.focus()}>Ghi memo</button>
      </div>
      <header>
        <p className="eyebrow">{label}</p>
        <h1 className="h-page" id="lesson-title" tabIndex={-1} ref={heading}>{lesson.title}</h1>
      </header>
      <section className="roadmap-reading">
        <h2 className="h-sec">Bối cảnh nghiệp vụ</h2>
        <p>{lesson.context}</p>
      </section>
      <section className="roadmap-reading">
        <h2 className="h-sec">Cách thực hiện</h2>
        <p>{lesson.explanation}</p>
        <ol>{lesson.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>
      {lesson.id === 'trm-05-02' && <SalaryPractice />}
      <section className="roadmap-reading">
        <h2 className="h-sec">Ví dụ và thực hành</h2>
        <p>{lesson.example}</p>
      </section>
      {lesson.id === 'trm-04-05' && <JobEvaluationPractice />}
      {lesson.id === 'trm-06-03' && <MeritPractice />}
      {lesson.id === 'trm-07-03' && <BonusPoolPractice />}
      {lesson.id === 'trm-09-03' && <SalaryAnalysisPractice />}
      <section className="roadmap-reading roadmap-review" aria-labelledby="scenario-title">
        <h2 className="h-sec" id="scenario-title">Tự ôn</h2>
        <p><strong>Cần nhớ</strong> · {lesson.takeaway}</p>
        <p>{lesson.review.question}</p>
        <div className="row">
          <button className="btn ghost" type="button" aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>
            {revealed ? 'Ẩn lời giải' : 'Xem lời giải'}
          </button>
        </div>
        {revealed && <p>{lesson.review.answer}</p>}
      </section>
      {!browseNext && <div className="row"><a className="btn ghost roadmap-link" href={reviewHref(moduleCode)}>Tự kiểm tra {moduleCode}</a></div>}
      <LessonReminder id={lesson.id} title={lesson.title} prompt={lesson.review.question} href={lessonHref(lesson.id)} />
      <LessonMemo id={lesson.id} notes={notes} />
      {related.length > 0 && <RoadmapRelatedCards ids={related} />}
      <p className="hint">Nguồn biên soạn · {source}</p>
      {error && <p role="alert">Chưa lưu được tiến độ. Hãy thử lại.</p>}
      {following && <p className="hint">Bài tiếp theo · {following.code} · {following.lesson.title}</p>}
      <div className="row">
        {done ? (
          <>
            <p className="hint">Đã hoàn thành</p>
            {following && <button className="btn" type="button" onClick={() => onNext(following.lesson)}>Học bài tiếp theo</button>}
          </>
        ) : (
          <button className="btn" type="button" disabled={saving || done === undefined} onClick={() => void finish()}>
            {saving ? 'Đang lưu…' : following ? 'Hoàn thành và học tiếp' : 'Hoàn thành và xem tiến độ'}
          </button>
        )}
        {browseNext && (!done || following?.lesson.id !== browseNext.id) && (
          <a className="btn ghost roadmap-link" href={lessonHref(browseNext.id)}>Đọc bài kế tiếp</a>
        )}
        <button className="btn ghost" type="button" onClick={onBack}>Chọn bài khác</button>
      </div>
    </article>
  );
}

function SalaryPractice() {
  const [prediction, setPrediction] = useState('');
  const [guess, setGuess] = useState<number>();
  const [invalidPrediction, setInvalidPrediction] = useState(false);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [result, setResult] = useState<string>();
  const salary = 19.2;
  const midpoint = 20;
  const compa = compaRatio(salary, midpoint) * 100;
  const difference = guess === undefined ? 0 : Math.round((guess - compa) * 10) / 10;

  return (
    <section className="stack" aria-labelledby="practice-title">
      <h2 className="h-sec" id="practice-title">Thử tính vị trí trong dải</h2>
      <p>Lương cơ bản {fmt(salary, 1)} triệu đồng/tháng, midpoint {midpoint} triệu. Hãy dự đoán compa-ratio.</p>
      <form className="stack" onSubmit={(event) => {
        event.preventDefault();
        const value = readAmount(prediction.replace(/%\s*$/, ''));
        setInvalidPrediction(!Number.isFinite(value));
        if (Number.isFinite(value)) setGuess(value);
      }}>
        <label className="field">
          Dự đoán compa-ratio (%)
          <input type="text" inputMode="decimal" maxLength={14} value={prediction} aria-invalid={invalidPrediction}
            aria-describedby="prediction-help" onChange={(event) => {
              setPrediction(event.target.value);
              setGuess(undefined);
              setInvalidPrediction(false);
              setResult(undefined);
            }} />
        </label>
        <p className="hint" id="prediction-help">Nhập phần trăm, ví dụ 85 hoặc 85,5%.</p>
        {invalidPrediction && <p role="alert">Nhập một tỷ lệ phần trăm hợp lệ.</p>}
        <div className="row">
          <button className="btn" type="submit">Đối chiếu dự đoán</button>
        </div>
      </form>
      <div className="stack" role="status">
        {guess !== undefined && (
          <>
            <p><strong>{fmt(salary, 1)} ÷ {midpoint} = {fmt(compa)}%.</strong> Bạn dự đoán {fmt(guess, Number.isInteger(guess) ? 0 : 1)}%.</p>
            <p>{difference === 0
              ? 'Dự đoán khớp với kết quả.'
              : `Dự đoán ${difference < 0 ? 'thấp' : 'cao'} hơn ${fmt(Math.abs(difference), Number.isInteger(difference) ? 0 : 1)} điểm phần trăm.`}</p>
          </>
        )}
      </div>
      {guess !== undefined && (
        <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          const low = readAmount(min);
          const high = readAmount(max);
          setResult(low > 0 && low < midpoint && high > midpoint
            ? `Vị trí trong dải: ${fmt(rangePenetration(salary, low, high), 1)}%.`
            : `Nhập min dương dưới ${midpoint} và max trên ${midpoint}. Dùng dấu phẩy hoặc dấu chấm cho phần thập phân.`);
        }}>
          <p>Nhập min và max rồi thử đổi độ rộng dải để xem range penetration thay đổi ra sao.</p>
          <label className="field">
            Min (triệu đồng/tháng)
            <input type="text" inputMode="decimal" value={min} placeholder="16" onChange={(e) => { setMin(e.target.value); setResult(undefined); }} />
          </label>
          <label className="field">
            Max (triệu đồng/tháng)
            <input type="text" inputMode="decimal" value={max} placeholder="24" onChange={(e) => { setMax(e.target.value); setResult(undefined); }} />
          </label>
          <div className="row">
            <button className="btn" type="submit">Tính vị trí trong dải</button>
          </div>
          <p role="status">{result}</p>
        </form>
      )}
    </section>
  );
}

function readAmount(raw: string) {
  const value = raw.trim();
  const amount = Number(value.replace(',', '.'));
  return /^\d+(?:[.,]\d+)?$/.test(value) && Number.isFinite(amount) ? amount : NaN;
}
