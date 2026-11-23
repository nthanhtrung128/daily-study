import { lessonHref } from '../../ui/routes';
import { useState } from 'react';
import { marketProfiles, marketRole } from './marketCase';
import { useFocusOnMount } from '../../ui/useFocusOnMount';

export function MarketMatchPractice() {
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const [revealed, setRevealed] = useState(false);
  const resultHeading = useFocusOnMount<HTMLHeadingElement>(revealed);
  const selected = marketProfiles.find((profile) => profile.id === choice);
  return <section className="roadmap-review stack" aria-labelledby="match-title">
    <h2 className="h-sec" id="match-title">Chọn hồ sơ khảo sát lương</h2>
    <p>{marketRole}</p>
    <p className="hint">Ba mẫu giả định cùng địa bàn. P50 là trung vị lương cơ bản tháng của công việc toàn thời gian, đơn vị triệu đồng.</p>
    <ul className="stack">{marketProfiles.map((p) => <li key={p.id}>
      <strong>{p.id} · {p.title}</strong><p>{p.scope}</p><p>P50 {p.median} triệu · {p.employers} doanh nghiệp · dữ liệu cách đây {p.age} tháng.</p>
    </li>)}</ul>
    <form className="stack" onSubmit={(e) => { e.preventDefault(); setRevealed(true); }}>
      <label className="field">Hồ sơ làm nguồn tham chiếu
        <select required value={choice} onChange={(e) => { setChoice(e.target.value); setRevealed(false); }}>
          <option value="">Chọn một hồ sơ</option>
          {marketProfiles.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.title}</option>)}
        </select>
      </label>
      <label className="field">Căn cứ của bạn từ trách nhiệm công việc
        <textarea required maxLength={1500} value={reason} onChange={(e) => { setReason(e.target.value); setRevealed(false); }} />
      </label>
      <div className="row"><button className="btn" disabled={!selected || !reason.trim()}>Đối chiếu hồ sơ</button></div>
    </form>
    {revealed && selected && <div className="stack">
      <h3 tabIndex={-1} ref={resultHeading}>{choice === 'B' ? 'Đã chọn đúng hồ sơ tham chiếu' : 'Hãy rà lại phạm vi công việc'}</h3>
      <p>{selected.feedback}</p>
      <p><strong>Tự kiểm tra căn cứ</strong> · Bạn đã nêu ai kiểm soát bảng lương, ai duyệt ngân sách và vì sao một hồ sơ khác kém phù hợp chưa?</p>
      <p>Trước khi đề xuất mức trả, cần biết thị trường đã thay đổi bao nhiêu kể từ ngày khảo sát và mẫu có đủ doanh nghiệp tương đương hay không.</p>
      <a className="btn ghost roadmap-link" href={lessonHref('trm-11-02')}>Luyện bảo vệ đề xuất ở M11.2</a>
    </div>}
  </section>;
}
