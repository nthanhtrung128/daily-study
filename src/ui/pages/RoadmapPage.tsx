import { useEffect, useState } from 'react';
import { fmt } from '../../core/num';
import { compaRatio, rangePenetration } from '../../modules/tr/calc';
import { completeLesson, firstIncompleteLesson, ROADMAP_MODULES, useRoadmapProgress, type RoadmapLesson } from '../../modules/tr/roadmap';
import { relatedCardIds } from '../../modules/tr/roadmapCards';
import { SalaryAnalysisPractice } from '../../modules/tr/SalaryAnalysisPractice';
import { MeritPractice } from '../../modules/tr/MeritPractice';
import { useFocusOnMount } from '../useFocusOnMount';
import { RoadmapRelatedCards } from '../components/RoadmapRelatedCards';
import { lessonHref } from '../routes';
import { useLocationHash } from '../useHashRoute';

export function RoadmapPage() {
  const completed = useRoadmapProgress();
  const hash = useLocationHash();
  const id = new URLSearchParams(hash.split('?')[1]).get('bai');
  const module = ROADMAP_MODULES.find((entry) => entry.lessons.some((lesson) => lesson.id === id));
  const selected = module?.lessons.find((lesson) => lesson.id === id);
  const heading = useFocusOnMount<HTMLHeadingElement>(!selected);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selected]);

  function open(lesson?: RoadmapLesson) {
    if (window.location.hash === hash) window.location.assign(lesson ? lessonHref(lesson.id) : '#lo-trinh');
  }

  if (selected && module) {
    const index = module.lessons.findIndex((lesson) => lesson.id === selected.id);
    return (
      <Lesson
        key={selected.id}
        lesson={selected}
        label={`${module.code} · Bài ${index + 1}/${module.lessons.length}`}
        source={module.source}
        done={completed?.includes(selected.id) ?? false}
        onBack={() => open()}
        next={module.lessons[index + 1]}
        onNext={open}
      />
    );
  }

  return (
    <section className="stack roadmap-library" aria-labelledby="roadmap-title">
      <header className="panel stack roadmap-intro">
        <h1 className="h-page" id="roadmap-title" tabIndex={-1} ref={heading}>Đọc và tự ôn Total Rewards</h1>
        <p>Chọn một bài để đọc bối cảnh, xem ví dụ và tự trả lời câu hỏi cuối bài.</p>
      </header>
      <div className="roadmap-modules">
        {ROADMAP_MODULES.map((entry) => {
          const count = entry.lessons.filter((lesson) => completed?.includes(lesson.id)).length;
          const next = completed && firstIncompleteLesson(entry.lessons, completed);
          return (
            <section className="panel stack" key={entry.code} aria-labelledby={`module-${entry.code}`}>
              <div>
                <p className="eyebrow">{entry.code}</p>
                <h2 className="h-sec" id={`module-${entry.code}`}>{entry.title}</h2>
              </div>
              <p>{entry.goal}</p>
              <p className="hint" aria-live="polite">{count}/{entry.lessons.length} bài đã hoàn thành</p>
              {next && (
                <div className="row">
                  <button className="btn" type="button" onClick={() => open(next)}>
                    {count ? 'Học tiếp' : 'Bắt đầu học'} · {next.title}
                  </button>
                </div>
              )}
              <ul className="roadmap-lessons">
                {entry.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <button className="btn ghost" type="button" onClick={() => open(lesson)}>
                      {lesson.title}{completed?.includes(lesson.id) ? ' · Đã hoàn thành' : ''}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function Lesson({ lesson, label, source, done, onBack, next, onNext }: {
  lesson: RoadmapLesson;
  label: string;
  source: string;
  done: boolean;
  onBack: () => void;
  next: RoadmapLesson | undefined;
  onNext: (lesson: RoadmapLesson) => void;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const related = relatedCardIds(lesson.id);

  async function finish() {
    setSaving(true);
    setError(false);
    try {
      await completeLesson(lesson.id);
      onBack();
    } catch {
      setSaving(false);
      setError(true);
    }
  }

  return (
    <article className="panel stack roadmap-reader" aria-labelledby="lesson-title">
      <div className="row">
        <button className="btn ghost small" type="button" onClick={onBack}>Về kho kiến thức</button>
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
      {lesson.id === 'trm-06-03' && <MeritPractice />}
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
      {related.length > 0 && <RoadmapRelatedCards ids={related} />}
      <p className="hint">Nguồn biên soạn · {source}</p>
      {error && <p role="alert">Chưa lưu được tiến độ. Hãy thử lại.</p>}
      <div className="row">
        {done ? (
          <p className="hint">Đã hoàn thành</p>
        ) : (
          <button className="btn" type="button" disabled={saving} onClick={() => void finish()}>
            {saving ? 'Đang lưu…' : 'Đánh dấu hoàn thành'}
          </button>
        )}
        {next && <button className="btn ghost" type="button" onClick={() => onNext(next)}>Đọc bài kế tiếp</button>}
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
