import { readEquity, emptyEquity } from '../../core/caseDraft';
import { useCaseDraft } from './useCaseDraft';
import { useState } from 'react';
import { useFocusOnMount } from '../../ui/useFocusOnMount';
import { TopicRecorder } from '../english/ui/TopicScreen';
import { CaseEvidence } from './CaseEvidence';
import { useCaseAttempts, saveCase } from './caseAttempts';

export const equityHref = '#lo-trinh?ho-so=cong-bang-luong';
export const equityCriteria = ['Chọn đúng nhóm đối sánh', 'Chọn đúng chênh lệch cần tìm hiểu', 'Tự giải thích bằng tiếng Anh'];
const profiles = [
  ['E01', '20', 'G6 · Hà Nội · kiểm hàng độc lập · ca ngày'],
  ['E02', '24', 'G6 · Hà Nội · kiểm hàng độc lập · ca ngày'],
  ['E03', '23', 'G6 · Hà Nội · kiểm hàng độc lập · ca ngày'],
  ['E04', '28', 'G7 · Hà Nội · duyệt kết quả của cả tổ · ca ngày'],
  ['E05', '26', 'G6 · TP.HCM · kiểm hàng độc lập · ca ngày'],
  ['E06', '18', 'G5 · Hà Nội · kiểm hàng có giám sát · ca ngày'],
  ['E07', '25', 'G6 · Hà Nội · bảo trì thiết bị · ca ngày'],
  ['E08', '16', 'G6 · Hà Nội · kiểm hàng độc lập · ca ngày · 60% thời gian'],
] as const;
const questions = ['Câu hỏi về phạm vi công việc', 'Câu hỏi về lịch sử lương', 'Câu hỏi về chất lượng dữ liệu'];
const topic = { id: 'tr-case-equity', en: 'Why do two people with the same title earn different salaries?',
  vi: 'Giải thích cho quản lý vì sao cần đối chiếu dữ liệu trước khi điều chỉnh lương.', hints: ['The gap warrants a closer look because…', 'Before deciding, I would check…'],
  topic: 'meetings', level: 'B2', seconds: 60 } as const;

export function PayEquityCase() {
  const history = useCaseAttempts('equity');
  const [retry, setRetry] = useState(false);
  const draft = useCaseDraft('equity', emptyEquity, readEquity);
  const { selected, gap, checks, spoken } = draft.fields;
  const [recorder, setRecorder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const latest = history?.[0];
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const result = useFocusOnMount<HTMLHeadingElement>(!!latest && !retry && !draft.version);
  async function submit() {
    setSaving(true); setError(false);
    const criteria = [selected.length === 2 && selected.includes('E02') && selected.includes('E03'), gap === 'E01', spoken === 'Đã giải thích được'];
    try {
      await saveCase('equity', ['Nhóm so sánh: ' + selected.join(', '), 'Hồ sơ cần kiểm tra: ' + gap, ...checks.map((c, i) => questions[i] + ': ' + c.trim())].join('\n'), criteria, draft.version);
      draft.reset(); setRetry(false);
    } catch { setError(true); } finally { setSaving(false); }
  }
  return <section className="panel stack roadmap-reader case-file" aria-label="Hồ sơ công bằng lương">
    <a className="btn ghost roadmap-link" href="#lo-trinh">Về lộ trình</a>
    <header><p className="eyebrow">Hồ sơ thực hành · Phân tích đãi ngộ</p>
      <h1 className="h-page" ref={heading} tabIndex={-1}>Hồ sơ công bằng lương</h1></header>
    <p>Quản lý kho Hà Nội gửi email: “E01 cho rằng mình được trả thấp hơn đồng nghiệp cùng chức danh. Ta nên điều chỉnh ngay bao nhiêu?” Bạn cần chọn nhóm đối sánh rồi đề xuất bước kiểm chứng.</p>
    {history === null || draft.status === 'failed' ? <p role="alert">Chưa đọc được hồ sơ trên máy. Hãy tải lại.</p> : history === undefined || draft.status === 'loading' ? <p>Đang đọc hồ sơ…</p> :
      latest && !retry && !draft.version ? <>
        <h2 ref={result} tabIndex={-1}>Phiếu điều tra đã lưu</h2><CaseEvidence attempt={latest} labels={equityCriteria} />
        <p>E02 và E03 cùng cấp, địa bàn, trách nhiệm, ca và thời lượng làm việc với E01. Mức tham chiếu của hai người là 23,5 triệu. E01 thấp hơn 3,5 triệu, khoảng 14,9% so với mức tham chiếu.</p>
        <p>E08 làm 60% thời gian. Mức quy đổi toàn thời gian là 16 / 0,6 ≈ 26,67 triệu đồng; cần xác minh thêm trước khi đưa vào mẫu. Hai người đối chứng là một mẫu nhỏ. Kiểm tra mô tả việc thực tế, lần tăng gần nhất, hiệu suất đã hiệu chỉnh và độ chính xác của dữ liệu trước khi định mức xử lý.</p>
        <p lang="en">The gap deserves a review. I would check the actual duties and pay history before recommending an adjustment.</p>
    <a className="btn ghost roadmap-link" href="#tien-do">So sánh các lần làm ở Tiến độ</a>
        <button className="btn ghost" onClick={() => { setRetry(true); draft.reset(); setRecorder(false); }}>Làm lại hồ sơ</button>
      </> : <>
        <div className="row"><button type="button" className="btn ghost" disabled={busy || saving || draft.savingDraft} onClick={() => void draft.pause()}>Lưu nháp và về Hôm nay</button></div>
      {draft.draftError && <p role="alert">{draft.draftError}</p>}
      <h2>1. Chọn người để so trực tiếp với E01</h2>
        <p>Lương cơ bản ghi trên hợp đồng, triệu đồng/tháng, trước thuế và chưa cộng phụ cấp. Các hồ sơ giả định làm toàn thời gian, trừ E08.</p>
        <fieldset className="checkpoint-question"><legend>Danh sách hồ sơ</legend>
          {profiles.map(([id, pay, scope]) => id === 'E01' ? <p key={id}><strong>E01 · {pay} triệu</strong><br />{scope}</p> :
            <label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={(e) => draft.edit({ selected: e.target.checked ? [...selected, id] : selected.filter((x) => x !== id) })} /><span><strong>{id} · {pay} triệu</strong><br />{scope}</span></label>)}
        </fieldset>
        <h2>2. Mở phiếu điều tra</h2><fieldset className="checkpoint-question"><legend>Hồ sơ nào cần xem xét trước về mức trả thấp trong nhóm so sánh?</legend>
          {['E01', 'E06', 'E08'].map((id) => <label key={id}><input type="radio" name="gap" checked={gap === id} onChange={() => draft.edit({ gap: id })} />{id}</label>)}</fieldset>
        {questions.map((q, i) => <label key={q} className="field">{q}<textarea maxLength={350} value={checks[i]} onChange={(e) => draft.edit({ checks: checks.map((v, j) => i === j ? e.target.value : v) })} /></label>)}
        <h2>3. Trả lời quản lý bằng tiếng Anh</h2><p lang="en">{topic.en}</p><p>{topic.vi} Nói trong một phút, nêu chênh lệch và một việc sẽ xác minh.</p>
        {recorder ? <TopicRecorder topic={{ ...topic, hints: [...topic.hints] }} onBusyChange={setBusy} /> :
          <button className="btn ghost" onClick={() => setRecorder(true)}>Mở ghi âm câu trả lời</button>}
        <fieldset className="checkpoint-question"><legend>Tôi đã giải thích khoảng chênh và bước kiểm chứng</legend>{['Đã giải thích được', 'Cần luyện thêm'].map((s) => <label key={s}><input type="radio" name="spoken" checked={spoken === s} onChange={() => draft.edit({ spoken: s })} />{s}</label>)}</fieldset>
        <button className="btn" disabled={!selected.length || !gap || !spoken || checks.some((c) => !c.trim()) || saving || draft.savingDraft || busy} onClick={() => void submit()}>Lưu phiếu và đối chiếu</button>
        {error && <p role="alert">Chưa lưu được phiếu. Hãy thử lại.</p>}
      </>}
  </section>;
}
