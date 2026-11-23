import { readOffers, emptyOffers } from '../../core/caseDraft';
import { useCaseDraft } from './useCaseDraft';
import { useState } from 'react';
import { useFocusOnMount } from '../../ui/useFocusOnMount';
import { TopicRecorder } from '../english/ui/TopicScreen';
import { readAmount } from './raiseBudget';
import { saveCase, useCaseAttempts } from './caseAttempts';
import { CaseEvidence } from './CaseEvidence';

export const offerHref = '#lo-trinh?ho-so=thu-moi';
export const offerCriteria = ['Tính tiền mặt bảo đảm', 'Tính thưởng và thu nhập khi hụt mục tiêu', 'Tự đặt câu hỏi thương lượng'];
const topic = { id: 'tr-case-offers', en: 'Ask the recruiter to clarify one term before you accept.',
  vi: 'Hỏi nhà tuyển dụng bằng tiếng Anh về điều khoản còn thiếu, giải thích vì sao điều đó ảnh hưởng quyết định.',
  topic: 'meetings' as const, level: 'B2' as const, seconds: 60, hints: ['Could you clarify whether…?', 'That would help me compare…'] };
const periods = ['Tiền mặt bảo đảm', 'Tổng tiền khi đạt 100% thưởng', 'Tổng tiền khi chỉ đạt 25% thưởng'];
const keys = ['A', 'B'];
const expected = [408, 420, 465.6, 462, 422.4, 430.5];

export function OfferCase() {
  const attempts = useCaseAttempts('offers');
  const [retry, setRetry] = useState(false);
  const draft = useCaseDraft('offers', emptyOffers, readOffers);
  const { numbers, choice, reason, question, spoken } = draft.fields;
  const [record, setRecord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const latest = attempts?.[0];
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const result = useFocusOnMount<HTMLHeadingElement>(!!latest && !retry && !draft.version);
  async function submit() {
    const matches = numbers.map((n, i) => readAmount(n) === expected[i]);
    const costs = periods.map((p, i) => p + ' (A/B): ' + numbers.slice(2 * i, 2 * i + 2).join(' / ')).join('\n');
    setSaving(true); setError(false);
    try {
      await saveCase('offers', [costs, 'Chọn ' + choice + '. ' + reason.trim(), 'Câu hỏi: ' + question.trim()].join('\n'),
        [matches[0]! && matches[1]!, matches.slice(2).every(Boolean), spoken === 'Đã hỏi được'], draft.version);
      draft.reset(); setRetry(false);
    } catch { setError(true); } finally { setSaving(false); }
  }
  function restart() {
    draft.reset(); setRecord(false); setRetry(true);
  }
  return <section className="panel stack roadmap-reader case-file" aria-label="So sánh hai thư mời">
    <a className="btn ghost roadmap-link" href="#lo-trinh">Về lộ trình</a>
    <header><p className="eyebrow">Hồ sơ thực hành · Total Rewards</p><h1 className="h-page" ref={heading} tabIndex={-1}>So sánh hai thư mời</h1></header>
    <p>Bạn có hai thư mời cho cùng vị trí. Bạn cần dòng tiền ổn định nhưng cũng coi trọng thời gian chăm sóc gia đình. Hãy so thu nhập theo năm rồi hỏi nhà tuyển dụng một điều khoản trước khi chọn.</p>
    {attempts === null || draft.status === 'failed' ? <p role="alert">Chưa đọc được hồ sơ trên máy. Hãy tải lại.</p> : attempts === undefined || draft.status === 'loading' ? <p>Đang mở thư mời…</p> : latest && !retry && !draft.version ? <>
      <h2 ref={result} tabIndex={-1}>Bản so sánh đã lưu</h2><CaseEvidence attempt={latest} labels={offerCriteria} />
      <p>A bảo đảm (32 + 2) × 12 = 408 triệu. Thưởng mục tiêu 32 × 12 × 15% = 57,6 triệu. Đủ thưởng được 465,6 triệu; ở mức chi trả 25% tiền thưởng chỉ còn 14,4 triệu, tổng 422,4 triệu.</p>
      <p>B bảo đảm 35 × 12 = 420 triệu. Thưởng mục tiêu 42 triệu, tổng 462 triệu. Nếu chỉ nhận một phần tư thưởng, tổng còn 430,5 triệu.</p>
      <p>B hơn A 12 triệu ở phần bảo đảm. A hơn B 3,6 triệu khi đạt đủ mục tiêu. Đối chiếu phạm vi bảo hiểm và điều kiện dùng ngày nghỉ theo nhu cầu riêng trước khi chốt. Cả hai lựa chọn đều có thể giải trình.</p>
      <p lang="en">Could you confirm whether my child is covered from the start date and whether there is an extra premium?</p>
      <p>Bạn có thể xác nhận con tôi được bảo hiểm từ ngày bắt đầu làm việc và có phải đóng thêm phí không?</p>
    <a className="btn ghost roadmap-link" href="#tien-do">So sánh các lần làm ở Tiến độ</a>
      <button className="btn ghost" onClick={restart}>So sánh lại hai thư mời</button>
    </> : <>
      <div className="row"><button type="button" className="btn ghost" disabled={busy || saving || draft.savingDraft} onClick={() => void draft.pause()}>Lưu nháp và về Hôm nay</button></div>
      {draft.draftError && <p role="alert">{draft.draftError}</p>}
      <h2>Thư A · Lương và phụ cấp cố định</h2><p>32 triệu/tháng cộng phụ cấp cố định 2 triệu/tháng. Thưởng mục tiêu 15% lương cơ bản năm. Bảo hiểm sức khỏe cho nhân viên; 16 ngày nghỉ phép.</p>
      <h2>Thư B · Lương và quyền lợi gia đình</h2><p>35 triệu/tháng, thưởng mục tiêu 10% lương cơ bản năm. 14 ngày nghỉ phép. Thư ghi có chương trình bảo hiểm người thân nhưng chưa nêu phí và ngày hiệu lực.</p>
      <p>Hai thư giả định làm đủ 12 tháng, lương trước thuế. Tính theo triệu đồng. Kịch bản thấp chi trả 25% số tiền thưởng mục tiêu. Ngày nghỉ và bảo hiểm được cân nhắc riêng.</p>
      {periods.map((p, i) => <fieldset className="checkpoint-question stack" key={p}><legend>{p}</legend>{keys.map((k, j) => {
        const index = i * 2 + j;
        return <label className="field offer-input" key={k}>Thư {k} · {p}<input type="text" inputMode="decimal" maxLength={10} value={numbers[index]} onChange={(e) => draft.edit({ numbers: numbers.map((n, pos) => pos === index ? e.target.value : n) })} /></label>;
      })}</fieldset>)}
      <fieldset className="checkpoint-question"><legend>Bạn ưu tiên thư nào?</legend>{keys.map((k) => <label key={k}><input type="radio" name="offer" checked={choice === k} onChange={() => draft.edit({ choice: k })} />Thư {k}</label>)}</fieldset>
      <label className="field">Lý do của bạn, gồm một con số và một quyền lợi<textarea maxLength={600} value={reason} onChange={(e) => draft.edit({ reason: e.target.value })} /></label>
      <label className="field">Viết câu hỏi thương lượng bằng tiếng Anh<textarea maxLength={350} value={question} onChange={(e) => draft.edit({ question: e.target.value })} /></label>
      <p>Nói câu hỏi như khi gọi lại nhà tuyển dụng. Nêu điều khoản còn thiếu và lý do bạn cần biết.</p>
      {record ? <TopicRecorder topic={topic} onBusyChange={setBusy} /> : <button className="btn ghost" onClick={() => setRecord(true)}>Mở ghi âm câu hỏi</button>}
      <fieldset className="checkpoint-question"><legend>Tôi đã hỏi rõ điều khoản và giải thích vì sao</legend>{['Đã hỏi được', 'Cần luyện thêm'].map((s) => <label key={s}><input type="radio" name="offer-speaking" checked={spoken === s} onChange={() => draft.edit({ spoken: s })} />{s}</label>)}</fieldset>
      <button className="btn" disabled={numbers.some((v) => readAmount(v) === undefined) || !choice || !reason.trim() || !question.trim() || !spoken || busy || saving || draft.savingDraft}
        onClick={() => void submit()}>Lưu so sánh và xem đáp án</button>
      {error && <p role="alert">Chưa lưu được bài. Hãy thử lại.</p>}
    </>}
  </section>;
}
