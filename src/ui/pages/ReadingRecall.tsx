import { useState } from 'react';
import { readAmount } from '../../modules/tr/raiseBudget';
import { dayKey } from '../../core/date';
import { recallMemoId, recallMemoLabel, useReadingMemos } from '../../modules/tr/readingMemos';
import { LessonMemo } from '../components/ReadingMemos';
import { fmt } from '../../core/num';
import { LessonReminder } from '../components/LessonReminder';
import { useFocusOnMount } from '../useFocusOnMount';

type Pair = { en: string; vi: string };
export type RecallCase = { prompt: Pair; unit: string; answer: number; feedback: string; model: Pair };

export function ReadingRecall({ id, lessonId, title, task, index, language }: {
  lessonId: string;
  id: string; title: Pair; task: RecallCase; index: number; language: 'en' | 'vi';
}) {
  const [value, setValue] = useState('');
  const [confidence, setConfidence] = useState('');
  const [revealed, setRevealed] = useState(false);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const result = useFocusOnMount<HTMLHeadingElement>(revealed);
  const other = language === 'en' ? 'vi' : 'en';
  const number = readAmount(value);
  const correct = number === task.answer;
  const articleHref = '#doc-them?bai=' + id;
  const nextHref = articleHref + '&tu-nho=' + (index === 0 ? 2 : 1);
  return <section className="panel stack roadmap-reader extra-reader" aria-label="Tự thử khi gấp bài">
    <div><a className="btn ghost roadmap-link" href={articleHref}>Về bài đọc</a></div>
    <header><p className="eyebrow">{title.vi}</p><h1 className="h-page" ref={heading} tabIndex={-1}>Tự thử khi gấp bài</h1></header>
    <p lang={language}>{task.prompt[language]}</p>
    <details className="recall-translation"><summary>{language === 'en' ? 'Xem nghĩa câu hỏi' : 'Xem câu hỏi tiếng Anh'}</summary><p lang={other}>{task.prompt[other]}</p></details>
    {revealed ? <>
      <h2 className="h-sec" ref={result} tabIndex={-1}>{correct ? 'Bạn tính đúng' : 'Đối chiếu phép tính'}</h2>
      <p>Bạn nhập {value} {task.unit}. Đáp án là {fmt(task.answer, Number.isInteger(task.answer) ? 0 : 1)} {task.unit}.</p>
      <p>{task.feedback}</p>
      {confidence && <p>{correct ? confidence === 'Còn phân vân' ? 'Bạn còn phân vân nhưng đã tính đúng. Thử gọi tên bước khiến bạn do dự.' : 'Lần này đáp số khớp với mức tự tin bạn đã chọn.' :
        confidence === 'Khá chắc' ? 'Bạn đã khá chắc về đáp số. Hãy tìm bước đầu tiên trong lập luận khác với lời giải.' : 'Bạn đã nhận ra chỗ chưa chắc. Nói lại bước đầu tiên bằng lời của mình.'}</p>}
      <h3>Một cách giải thích bằng tiếng Anh</h3><p lang="en">{task.model.en}</p><p>{task.model.vi}</p>
      <p className="hint">Đối chiếu với câu mẫu: bạn đã giải thích lý do chọn phép tính và nêu đúng đơn vị chưa?</p>
      <div className="row"><a className="btn roadmap-link" href={nextHref}>Thử tình huống khác</a></div>
      <RecallMemo lessonId={lessonId} variant={index + 1} />
      <LessonReminder id={'reading-recall-' + id} title={title.vi} prompt={'Tự tính trước khi xem lại lời giải · ' + title.vi} href={nextHref} />
    </> : <form className="stack" onSubmit={(e) => { e.preventDefault(); if (number !== undefined) setRevealed(true); }}>
      <label className="field">Đáp số ({task.unit})<input type="text" inputMode="decimal" maxLength={10} value={value} onChange={(e) => setValue(e.target.value)} /></label>
      <p>Nói một câu tiếng Anh để giải thích vì sao bạn chọn phép tính này.</p>
      <fieldset className="checkpoint-question recall-confidence"><legend>Bạn chắc về đáp số đến đâu? (tùy chọn)</legend>
        {['Còn phân vân', 'Khá chắc'].map((v) => <label key={v}><input type="radio" name="confidence" checked={confidence === v} onChange={() => setConfidence(v)} />{v}</label>)}</fieldset>
      <div className="row"><button className="btn" disabled={number === undefined}>Đối chiếu đáp số</button></div>
    </form>}
  </section>;
}

function RecallMemo({ lessonId, variant }: { lessonId: string; variant: number }) {
  const [day] = useState(() => dayKey());
  const notes = useReadingMemos();
  return <details>
    <summary>Ghi memo lần tự thử</summary>
    <LessonMemo id={recallMemoId(lessonId, variant, day)} notes={notes}
      title={recallMemoLabel(variant, day)}
      prompt="Bạn tự tính được đến bước nào? Có cần xem lại bài hoặc đọc câu mẫu để giải thích bằng tiếng Anh?" />
    <a className="reading-result-link" href="#lo-trinh?memo=1">Mở sổ memo</a>
  </details>;
}
