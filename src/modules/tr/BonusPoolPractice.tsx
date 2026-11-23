import { useState } from 'react';
import { fmt } from '../../core/num';
import { allocateBonus, samplePeople, samplePool, type BonusInput } from './bonusPool';

export function BonusPoolPractice() {
  const [budget, setBudget] = useState(String(samplePool.budget));
  const [people, setPeople] = useState(samplePeople);
  const [index, setIndex] = useState(0);
  const current = people[index]!;
  const result = allocateBonus(budget, people);
  const row = result.rows?.[index];
  function change(field: keyof Omit<BonusInput, 'id'>, value: string) {
    setPeople((old) => old.map((person, i) => i === index ? { ...person, [field]: value } : person));
  }

  return <section className="stack roadmap-review" aria-labelledby="pool-title">
    <h2 className="h-sec" id="pool-title">Thử phân bổ quỹ thưởng</h2>
    <p>Năm nhân viên cùng chia một quỹ. Điểm mỗi người bằng thưởng mục tiêu × tỷ lệ thời gian đủ điều kiện × hệ số đóng góp. Tiền thưởng bằng quỹ nhân với tỷ trọng điểm.</p>
    <label className="field">Quỹ thưởng (triệu đồng)
      <input type="text" inputMode="decimal" maxLength={10} value={budget} onChange={(e) => setBudget(e.target.value)} />
    </label>
    <div className="field" role="group" aria-label="Chọn nhân viên">
      <span>Chọn nhân viên để thử thay đổi</span>
      <div className="row">{people.map((person, i) => <button className="chip" type="button" key={person.id}
        aria-pressed={index === i} onClick={() => setIndex(i)}>{person.id}</button>)}</div>
    </div>
    <div className="roadmap-fields">
      <label className="field">Thưởng mục tiêu (triệu đồng)
        <input type="text" inputMode="decimal" maxLength={10} value={current.target} onChange={(e) => change('target', e.target.value)} />
      </label>
      <label className="field">Thời gian đủ điều kiện (%)
        <input type="text" inputMode="decimal" maxLength={6} value={current.eligible} onChange={(e) => change('eligible', e.target.value)} />
      </label>
      <label className="field">Hệ số đóng góp
        <input type="text" inputMode="decimal" maxLength={10} value={current.factor} onChange={(e) => change('factor', e.target.value)} />
      </label>
    </div>
    <div className="stack" role="status">
      {result.error ? <p>{result.error}</p> : result.rows && row && <>
        <p><strong>{current.id}</strong> có {fmt(row.points, 2)} trên {fmt(result.points, 2)} điểm, chiếm {fmt(row.share, 2)}% quỹ.</p>
        {result.points === 0 && <p>Chưa có nhân viên có điểm phân bổ dương. Quỹ được giữ lại cho đến khi có người đủ điều kiện.</p>}
        <ul className="pool-amounts" aria-label="Tiền thưởng từng người">{result.rows.map((person) =>
          <li key={person.id}>{person.id} · <b>{fmt(person.amount, 2)} triệu</b></li>)}</ul>
        <p><strong>Đã phân bổ {fmt(result.paid, 2)} triệu · Còn lại {fmt(result.unallocated, 2)} triệu</strong></p>
      </>}
    </div>
    <div className="row"><button className="btn ghost" type="button" onClick={() => {
      setPeople(samplePeople()); setBudget(String(samplePool.budget)); setIndex(0);
    }}>Khôi phục quỹ và hồ sơ mẫu</button></div>
    <p>Hãy thử giảm thời gian của NV03 từ 75% xuống 50% và giữ quỹ ở 300 triệu đồng. Quan sát cả năm khoản chi. Khi một người có ít điểm hơn, cùng một quỹ sẽ phân bổ lại cho những người còn điểm.</p>
    <p className="hint">Số tiền làm tròn đến 0,01 triệu đồng. Phần lẻ còn lại lần lượt dành cho người có phần dư lớn nhất, bằng nhau thì theo thứ tự hồ sơ. Quy chế cam kết một mức trả riêng cho từng người sẽ cần cách tính khác.</p>
  </section>;
}
