import { useState } from 'react';
import { lessonHref } from '../../ui/routes';
import { TopicRecorder } from '../english/ui/TopicScreen';
import { RecordingList } from '../english/ui/RecordingList';
import { SpeakButton } from '../english/ui/SpeakButton';
import type { SpeakingTopic } from '../english/speech/topics';
import { useTtsLifecycle } from '../english/useTts';
import { tts } from '../english/tts';
import { marketProfiles } from './marketCase';

const objection = 'Why shouldn’t we use the cheaper benchmark?';
const [regional, supervisor, specialist] = marketProfiles;
const pitch: SpeakingTopic = {
  id: 'tr-m11-benchmark-pitch', en: 'Recommend a salary benchmark for the payroll supervisor.',
  vi: 'Trong một phút, đề xuất nguồn tham chiếu, giải thích căn cứ và nêu việc cần làm trước khi chốt mức trả.',
  topic: 'cb-hr', level: 'B2', seconds: 60,
  hints: ['I recommend using the supervisor benchmark because…', 'The survey is twelve months old, so…'],
};
const reply: SpeakingTopic = {
  id: 'tr-m11-benchmark-reply', en: objection,
  vi: 'Trả lời CFO bằng cách thừa nhận mối quan tâm về chi phí rồi đối chiếu trách nhiệm và đề nghị bước kiểm chứng.',
  topic: 'meetings', level: 'B2', seconds: 60,
  hints: ['I understand the budget concern.', 'The cheaper role is an individual contributor, whereas…', 'Before we decide, I will…'],
};
const criteria = ['Nêu đúng số P50, đơn vị và vai trò tương ứng.', 'Giải thích quyền kiểm soát của trưởng nhóm và giới hạn về thời điểm khảo sát.', 'Đề xuất một việc cụ thể để xác minh trước khi quyết định mức trả.'];

export function BenchmarkPitch() {
  const [stage, setStage] = useState(0);
  const [record, setRecord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState([false, false, false]);
  useTtsLifecycle();
  function go(next: number) {
    tts.cancel();
    setRecord(false);
    setStage(next);
  }
  return <section className="roadmap-review stack" aria-labelledby="pitch-title">
    <h2 className="h-sec" id="pitch-title">Bảo vệ đề xuất trước CFO</h2>
    <p>Trưởng nhóm kiểm soát bảng lương của ba chuyên viên tại một nhà máy. CFO cần một mức tham chiếu để lập ngân sách. Số liệu giả định từ bài M08.2.</p>
    <p>P50 lương cơ bản tháng · A quản lý nhiều nhà máy {regional.median} triệu · B giám sát tại một nhà máy {supervisor.median} triệu (khảo sát cách đây {supervisor.age} tháng) · C chuyên viên cá nhân {specialist.median} triệu đồng.</p>
    <a className="btn ghost roadmap-link" href={lessonHref('trm-08-02')}>Xem ba hồ sơ ở M08.2</a>
    <div className="row" role="group" aria-label="Chọn lượt luyện">{['1. Trình bày', '2. Trả lời CFO', '3. Nghe lại'].map((label, i) =>
      <button type="button" className="chip" disabled={busy} aria-pressed={stage === i} onClick={() => go(i)} key={label}>{label}</button>)}</div>
    {stage < 2 ? <>
      <h3>{stage === 0 ? 'Trình bày đề xuất trong 60 giây' : 'CFO hỏi về mức tham chiếu thấp hơn'}</h3>
      <p lang="en">{stage === 0 ? pitch.en : objection}</p><p>{stage === 0 ? pitch.vi : reply.vi}</p>
      {stage === 1 && !record && <div className="row"><SpeakButton text={objection} label="Nghe câu hỏi của CFO" /></div>}
      {!record && <div className="row"><button className="btn ghost" type="button" onClick={() => { tts.cancel(); setRecord(true); }}>Mở ghi âm lượt này</button></div>}
      {record && <TopicRecorder key={stage} topic={stage === 0 ? pitch : reply} onBusyChange={setBusy} />}
      <p className="hint">Bạn có thể nói thành tiếng rồi chuyển lượt. Khi ghi âm, bấm Dừng &amp; lưu trước khi chuyển.</p>
      <div className="row"><button disabled={busy} className="btn" type="button" onClick={() => go(stage + 1)}>{stage === 0 ? 'Tiếp đến câu hỏi CFO' : 'Đối chiếu hai lượt nói'}</button></div>
    </> : <>
      <h3>Nghe lại lời đề xuất</h3><RecordingList topicId={pitch.id} limit={1} />
      <h3>Nghe lại lời phản hồi</h3><RecordingList topicId={reply.id} limit={1} />
      <fieldset className="checkpoint-question pitch-criteria"><legend>Tự đánh giá sau khi nói</legend>{criteria.map((text, i) => <label key={text}><input type="checkbox" checked={checked[i]} onChange={(e) => setChecked(checked.map((v, j) => j === i ? e.target.checked : v))} />{text}</label>)}</fieldset>
      <p>Chọn một câu cần nói rõ hơn, ghi vào memo của bài rồi thử lại lượt tương ứng.</p>
    </>}
  </section>;
}
