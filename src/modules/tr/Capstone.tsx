import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db } from '../../core/db';
import { readTransfer, transferPrefix, type TransferResult } from '../../core/transfer';
import { useFocusOnMount } from '../../ui/useFocusOnMount';
import { TopicRecorder } from '../english/ui/TopicScreen';
import { RecordingList } from '../english/ui/RecordingList';
import type { SpeakingTopic } from '../english/speech/topics';
import { raiseBudget, readAmount } from './raiseBudget';

import { casePrefix } from './caseAttempts';
import { draftKey, emptyDraft, readDraft, type CapstoneDraft } from './capstoneDraft';

const key = transferPrefix + 'capstone';
export const capstoneHref = '#lo-trinh?tong-ket=1';
const topic: SpeakingTopic = {
  id: 'tr-capstone-retention', topic: 'meetings', level: 'B2', seconds: 90,
  en: 'Recommend a retention decision to the finance director.',
  vi: 'Trong 90 giây, nêu quyết định, căn cứ và bước xác minh trước khi giải ngân.',
  hints: ['My recommendation is…', 'This year we can afford…', 'Before approval, I would check…'],
};
export const capstoneCriteria = ['Nguồn so sánh', 'Chi phí và lựa chọn trong quỹ', 'Trình bày và bước kiểm chứng'];
const amounts = ['A trong năm', 'A đủ 12 tháng', 'B trong năm', 'B đủ 12 tháng'];
const a = raiseBudget(20, 4, 7)!;
const b = raiseBudget(20, 3, 10)!;

export function Capstone() {
  const [saved, setSaved] = useState<TransferResult | null>();
  const [draft, setDraft] = useState<CapstoneDraft>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(false);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  useEffect(() => {
    const sub = liveQuery(() => db.settings.bulkGet([key, draftKey])).subscribe({
      next: ([row, partial]) => { setSaved(readTransfer(row?.value) ?? null); setDraft(readDraft(partial?.value)); }, error: () => setFailed(true),
    });
    return () => sub.unsubscribe();
  }, []);
  return <section className="panel stack roadmap-reader capstone" aria-label="Bài tổng hợp cuối khóa">
    <div><a className="btn ghost roadmap-link" href="#lo-trinh">Về lộ trình</a></div>
    <h1 className="h-page" tabIndex={-1} ref={heading}>Bài tổng hợp cuối khóa</h1>
    <p>Tại một trung tâm dịch vụ, 4 trong 20 trưởng ca đã xin nghỉ trong quý. Một người nhắc đến lương, hai người nhắc đến lịch ca, một người chưa phản hồi. Giám đốc muốn dùng quỹ tăng lương 60 triệu đồng còn lại của năm nay để giữ người.</p>
    {failed ? <p role="alert">Chưa đọc được bài đã lưu. Hãy tải lại để thử lại.</p> : saved === undefined ? <p role="status">Đang đọc kết quả…</p> :
      saved && !retry && !draft ? <Result saved={saved} onRetry={() => setRetry(true)} /> :
      <Submission initial={draft ?? emptyDraft} onSave={(value) => { setSaved(value); setRetry(false); }} />}
  </section>;
}

function Submission({ initial, onSave }: { initial: CapstoneDraft; onSave: (value: TransferResult) => void }) {
  const [draft, setDraft] = useState(initial);
  const [draftError, setDraftError] = useState(false);
  const { source, costs, plan, memo, assessment } = draft;
  function change(patch: Partial<CapstoneDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    void db.settings.put({ key: draftKey, value: next }).then(() => setDraftError(false), () => setDraftError(true));
  }
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const ready = source && plan && memo.trim() && assessment && costs.every((v) => readAmount(v) !== undefined);
  async function submit() {
    if (!ready || busy || saving) return;
    const expected = [a.year, a.full, b.year, b.full];
    const result = {
      at: Date.now(), criteria: [source === 'Y', plan === 'B' && costs.every((v, i) => readAmount(v) === expected[i]), assessment === 'Đã làm được'],
      response: 'Nguồn ' + source + ' · ' + amounts.map((name, i) => name + ' ' + costs[i] + ' triệu').join(' · ') +
        ' · Phương án ' + plan + '. ' + memo.trim(),
    };
    setSaving(true); setError(false);
    try {
      await db.transaction('rw', db.settings, async () => {
        const old = readTransfer((await db.settings.get(key))?.value);
        if (old) await db.settings.put({ key: casePrefix + 'capstone.' + old.at, value: old });
        await db.settings.put({ key: casePrefix + 'capstone.' + result.at, value: result });
        await db.settings.put({ key, value: result });
        await db.settings.delete(draftKey);
      });
      onSave(result);
    }
    catch { setError(true); setSaving(false); }
  }
  return <div className="stack">
    {draftError && <p role="alert">Chưa lưu được bản nháp trên máy.</p>}
    <fieldset className="checkpoint-question"><legend>1. Chọn nguồn so sánh lương cơ bản tháng</legend>
      <p>Trưởng ca phân công 6–8 người tại một điểm, trình duyệt chi. Chọn nguồn để kiểm chứng trước.</p>
      {['X · Cùng chức danh, quản lý ba điểm và duyệt ngân sách, P50 là 32 triệu.',
        'Y · Xếp lịch ở một điểm và trình duyệt chi, P50 là 22 triệu, khảo sát cách đây chín tháng.'].map((item) =>
        <label key={item}><input type="radio" name="benchmark" checked={source === item[0]} onChange={() => change({ source: item.charAt(0) })} />{item}</label>)}
    </fieldset>
    <h2 className="h-sec">2. Tính hai phương án ngân sách</h2>
    <p>Hiện có đủ 20 trưởng ca, lương bình quân 20 triệu đồng/tháng. A tăng 4% từ đầu tháng 7. B tăng 3% từ đầu tháng 10. Giả định giữ nguyên định biên, chỉ tính lương cơ bản và hưởng trọn tháng.</p>
    {amounts.map((name, i) => <label className="field" key={name}>{name} (triệu đồng)
      <input type="text" inputMode="decimal" maxLength={10} value={costs[i]} onChange={(e) => change({ costs: costs.map((v, j) => i === j ? e.target.value : v) })} /></label>)}
    <fieldset className="checkpoint-question"><legend>Phương án nào vừa quỹ năm nay?</legend>
      {['A', 'B'].map((name) => <label key={name}><input type="radio" name="plan" checked={plan === name} onChange={() => change({ plan: name })} />{name}</label>)}</fieldset>
    <h2 className="h-sec">3. Trình bày với giám đốc trong 90 giây</h2>
    <label className="field">Viết đề xuất để lưu. Nêu căn cứ, giới hạn bằng chứng nghỉ việc và việc cần xác minh.
      <textarea maxLength={1500} value={memo} onChange={(e) => change({ memo: e.target.value })} /></label>
    <p>Nói thành tiếng dựa trên đề xuất. Nếu muốn nghe lại, bạn có thể ghi âm trên thiết bị.</p>
    {recording ? <TopicRecorder topic={topic} onBusyChange={setBusy} /> : <div className="row"><button className="btn ghost" onClick={() => setRecording(true)}>Mở ghi âm 90 giây</button></div>}
    <fieldset className="checkpoint-question"><legend>Tự chấm lượt nói · Tôi đã nêu quyết định, giới hạn bằng chứng và một bước xác minh.</legend>
      {['Đã làm được', 'Cần luyện thêm'].map((s) => <label key={s}><input type="radio" name="pitch" checked={assessment === s} onChange={() => change({ assessment: s })} />{s}</label>)}</fieldset>
    <div className="row"><button className="btn" disabled={!ready || busy || saving} onClick={() => void submit()}>Lưu đề xuất và đối chiếu</button></div>
    {error && <p role="alert">Chưa lưu được đề xuất. Hãy thử lại.</p>}
  </div>;
}

function Result({ saved, onRetry }: { saved: TransferResult; onRetry: () => void }) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return <div className="stack">
    <h2 className="h-sec" tabIndex={-1} ref={heading}>Đề xuất đã lưu trên máy</h2>
    <p>{saved.response}</p><ul>{capstoneCriteria.map((label, i) => <li key={label}>{label} · {saved.criteria[i] ? 'Đạt' : 'Cần luyện'} ({i === 2 ? 'tự đánh giá' : 'đối chiếu đáp án'})</li>)}</ul>
    <p><strong>Nguồn lương.</strong> Y gần công việc thực tế hơn về phạm vi và quyền hạn. Kiểm tra tuổi, cỡ mẫu và biến động thị trường trước khi dùng P50.</p>
    <p><strong>Ngân sách.</strong> Mỗi tháng A tăng 16 triệu, B tăng 12 triệu. A là {a.year} triệu trong năm và {a.full} triệu đủ năm. B là {b.year} triệu trong năm và {b.full} triệu đủ năm. B còn dư {60 - b.year} triệu trong quỹ.</p>
    <p><strong>Lập luận.</strong> Có thể đề xuất B trong quỹ và kiểm tra lịch ca cùng dữ liệu lương trước khi giải ngân. Bốn lượt nghỉ chưa đủ để quy nguyên nhân cho lương.</p>
    {saved.criteria.includes(false) && <a className="btn ghost roadmap-link" href="#hom-nay">Xem lịch ôn tiêu chí ở Hôm nay</a>}
    <a className="btn ghost roadmap-link" href="#tien-do">So sánh các lần làm ở Tiến độ</a>
    <nav className="stack" aria-label="Bài đọc để ôn theo tiêu chí">
      <h3>Đọc lại theo tiêu chí</h3>
      <a className="reading-result-link" href="#doc-them?bai=kiem-tra-mau-luong">Chọn nguồn · Hai trưởng nhóm, hai phạm vi công việc</a>
      <a className="reading-result-link" href="#doc-them?bai=thu-du-toan">Ngân sách · Email về chi phí tăng đủ năm</a>
      <a className="reading-result-link" href="#doc-them?bai=kiem-chung-nghi-viec">Lập luận · Bốn lượt nghỉ việc cho biết điều gì?</a>
    </nav>
    <details><summary>Nghe lại bản ghi của bài</summary><RecordingList topicId={topic.id} limit={1} /></details>
    <div className="row"><button className="btn ghost" onClick={onRetry}>Làm lại đề xuất</button></div>
    <p className="hint">Lần nộp tiếp theo sẽ cập nhật đề xuất đã lưu.</p>
  </div>;
}
