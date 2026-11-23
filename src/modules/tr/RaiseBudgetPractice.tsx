import { useState } from 'react';
import { fmt } from '../../core/num';
import { monthlyBase, raiseBudget, readAmount, yearLimit } from './raiseBudget';

export function RaiseBudgetPractice() {
  const [people, setPeople] = useState('50');
  const [rate, setRate] = useState('3');
  const [month, setMonth] = useState(7);
  const [yearGuess, setYearGuess] = useState('');
  const [fullGuess, setFullGuess] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [choice, setChoice] = useState('');
  const count = /^\d{1,5}$/.test(people.trim()) ? Number(people) : NaN;
  const a = raiseBudget(count, readAmount(rate) ?? NaN, month);
  const b = raiseBudget(count, 2, 10);
  const year = readAmount(yearGuess);
  const full = readAmount(fullGuess);

  function reset() {
    setYearGuess(''); setFullGuess(''); setRevealed(false); setChoice('');
  }
  const selected = choice === 'A' ? a : b;
  const fits = choice === 'Sửa cả hai' ? !!a && !!b && a.year > yearLimit && b.year > yearLimit : !!selected && selected.year <= yearLimit;
  return <section className="roadmap-review stack" aria-labelledby="budget-title">
    <h2 className="h-sec" id="budget-title">Dự toán ngân sách tăng lương</h2>
    <p>Quỹ tăng lương cơ bản cho năm nay là {yearLimit} triệu đồng. Lương trước tăng bình quân {monthlyBase} triệu đồng/người/tháng. So hai phương án cho cùng nhóm, giả định làm đủ năm, áp dụng từ đầu tháng và chưa tính chi phí đi kèm.</p>
    <h3>Phương án A của bạn</h3>
    <label className="field">Số người được tăng
      <input inputMode="numeric" value={people} maxLength={5} onChange={(e) => { setPeople(e.target.value); reset(); }} /></label>
    <label className="field">Tỷ lệ tăng (%)
      <input inputMode="decimal" value={rate} maxLength={6} onChange={(e) => { setRate(e.target.value); reset(); }} /></label>
    <label className="field">Tháng bắt đầu tăng
      <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); reset(); }}>
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}
      </select></label>
    {!a && <p role="status">Nhập số người nguyên từ 0 đến 10.000 và tỷ lệ từ 0 đến 100%, tối đa hai chữ số thập phân.</p>}
    <p>Phương án B được đề xuất là tăng 2% từ tháng 10. Trước khi so hai phương án, hãy dự đoán hai khoản tăng thêm của A, tính theo triệu đồng.</p>
    <form className="stack" onSubmit={(e) => { e.preventDefault(); setRevealed(true); }}>
      <label className="field">Dự đoán chi phí tăng trong năm nay (triệu đồng)
        <input inputMode="decimal" value={yearGuess} onChange={(e) => { setYearGuess(e.target.value); setRevealed(false); setChoice(''); }} /></label>
      <label className="field">Dự đoán chi phí tăng đủ 12 tháng (triệu đồng)
        <input inputMode="decimal" value={fullGuess} onChange={(e) => { setFullGuess(e.target.value); setRevealed(false); setChoice(''); }} /></label>
      <div className="row"><button className="btn" disabled={!a || year === undefined || full === undefined}>Đối chiếu ngân sách</button></div>
    </form>
    {revealed && a && b && year !== undefined && full !== undefined && <div className="stack">
      <p role="status"><strong>Phương án A</strong> · {a.months} tháng trong năm nay, tăng {fmt(a.year, 2)} triệu ({Math.abs(year - a.year) <= 0.01 ? 'dự đoán khớp' : 'xem lại số tháng'}). Đủ 12 tháng tăng {fmt(a.full, 2)} triệu ({Math.abs(full - a.full) <= 0.01 ? 'dự đoán khớp' : 'tính lại trên 12 tháng'}).</p>
      <p>Chi phí mỗi tháng = {count} người × {monthlyBase} triệu × {rate}%. Tháng hiệu lực được tính trọn tháng.</p>
      <p><strong>Phương án B</strong> · 3 tháng trong năm nay, tăng {fmt(b.year, 2)} triệu. Đủ 12 tháng tăng {fmt(b.full, 2)} triệu.</p>
      <fieldset className="checkpoint-question budget-choice"><legend>Bạn chọn phương án nào với quỹ {yearLimit} triệu năm nay?</legend>
        {['A', 'B', 'Sửa cả hai'].map((label) => <label key={label}><input type="radio" name="chon-ngan-sach" checked={choice === label} onChange={() => setChoice(label)} />{label}</label>)}</fieldset>
      {choice && <p role="status">{fits ? 'Quyết định phù hợp với quỹ năm nay.' : 'Hãy đối chiếu lại với giới hạn của năm nay.'}
        {' '}{choice === 'Sửa cả hai' ? 'Chỉ cần sửa cả hai khi mỗi phương án đều vượt quỹ.' :
          selected && (selected.year <= yearLimit ? 'Số quỹ còn lại ' : 'Số vượt quỹ ') + fmt(Math.abs(yearLimit - selected.year), 2) + ' triệu đồng.'}
        {' '}Khi đề xuất cho năm sau, dùng chi phí tăng đủ 12 tháng nếu nhân sự và mức lương giữ nguyên.</p>}
    </div>}
  </section>;
}
