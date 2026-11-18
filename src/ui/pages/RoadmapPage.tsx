import { useState } from 'react';
import { fmt } from '../../core/num';
import { compaRatio, rangePenetration } from '../../modules/tr/calc';
import { completeLesson, module05, useRoadmapProgress } from '../../modules/tr/roadmap';
import { useFocusOnMount } from '../useFocusOnMount';

export function RoadmapPage() {
  const completed = useRoadmapProgress();
  const [selected, setSelected] = useState<string>();
  const heading = useFocusOnMount<HTMLHeadingElement>(!selected);
  const lesson = module05.lessons.find((entry) => entry.id === selected);
  const next = module05.lessons.find((entry) => !completed?.includes(entry.id));

  function open(id?: string) {
    setSelected(id);
    window.scrollTo(0, 0);
  }

  if (lesson) {
    return (
      <Lesson
        key={lesson.id}
        lesson={lesson}
        done={completed?.includes(lesson.id) ?? false}
        onBack={() => open()}
      />
    );
  }

  return (
    <section className="panel stack" aria-labelledby="roadmap-title">
      <div>
        <p className="eyebrow">Lộ trình Total Rewards · M05</p>
        <h1 className="h-page" id="roadmap-title" tabIndex={-1} ref={heading}>{module05.title}</h1>
        <p>{module05.goal}</p>
      </div>
      <p className="hint" aria-live="polite">
        {module05.lessons.filter((entry) => completed?.includes(entry.id)).length}/{module05.lessons.length} bài đã hoàn thành
      </p>
      {next && (
        <div className="row">
          <button className="btn" type="button" onClick={() => open(next.id)}>
            {next === module05.lessons[0] ? 'Bắt đầu học' : 'Học tiếp'} · {next.title}
          </button>
        </div>
      )}
      <ul className="roadmap-lessons">
        {module05.lessons.map((entry) => (
          <li key={entry.id}>
            <button className="btn ghost" type="button" onClick={() => open(entry.id)}>
              {entry.title}{completed?.includes(entry.id) ? ' · Đã hoàn thành' : ''}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Lesson({ lesson, done, onBack }: {
  lesson: typeof module05.lessons[number];
  done: boolean;
  onBack: () => void;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

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
    <article className="panel stack" aria-labelledby="lesson-title">
      <div className="row">
        <button className="btn ghost small" type="button" onClick={onBack}>Về mô-đun M05</button>
      </div>
      <h1 className="h-page" id="lesson-title" tabIndex={-1} ref={heading}>{lesson.title}</h1>
      <p>{lesson.explanation}</p>
      {lesson.id === 'trm-05-02' && <SalaryPractice />}
      <h2 className="h-sec">Ví dụ và thực hành</h2>
      <p>{lesson.example}</p>
      {lesson.id === 'trm-05-02' && (
        <section className="stack" aria-labelledby="scenario-title">
          <h2 className="h-sec" id="scenario-title">Tự kiểm tra</h2>
          <p>{module05.scenario.question}</p>
          <div className="row">
            <button className="btn ghost" type="button" aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>
              {revealed ? 'Ẩn lời giải' : 'Xem lời giải'}
            </button>
          </div>
          {revealed && <p>{module05.scenario.answer}</p>}
        </section>
      )}
      {error && <p role="alert">Chưa lưu được tiến độ. Hãy thử lại.</p>}
      <div className="row">
        {done ? (
          <p className="hint">Đã hoàn thành</p>
        ) : (
          <button className="btn" type="button" disabled={saving} onClick={() => void finish()}>
            {saving ? 'Đang lưu…' : 'Đánh dấu hoàn thành'}
          </button>
        )}
      </div>
    </article>
  );
}

function SalaryPractice() {
  const [showCompa, setShowCompa] = useState(false);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [result, setResult] = useState<string>();
  const salary = 18;
  const midpoint = 20;

  return (
    <section className="stack" aria-labelledby="practice-title">
      <h2 className="h-sec" id="practice-title">Thử tính vị trí trong dải</h2>
      <p>Lương cơ bản 18 triệu đồng/tháng, midpoint 20 triệu. Hãy dự đoán compa-ratio.</p>
      <div className="row">
        <button className="btn ghost" type="button" aria-expanded={showCompa} onClick={() => setShowCompa(!showCompa)}>
          {showCompa ? 'Ẩn compa-ratio' : 'Xem compa-ratio'}
        </button>
      </div>
      {showCompa && (
        <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          const low = readAmount(min);
          const high = readAmount(max);
          setResult(low > 0 && low < midpoint && high > midpoint
            ? `Vị trí trong dải: ${fmt(rangePenetration(salary, low, high), 1)}%.`
            : 'Nhập min dương dưới 20 và max trên 20. Dùng dấu phẩy hoặc dấu chấm cho phần thập phân.');
        }}>
          <p>18 ÷ 20 = {fmt(compaRatio(salary, midpoint) * 100)}%. Nhập min và max rồi thử đổi độ rộng dải để xem chỉ số thứ hai thay đổi ra sao.</p>
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
