import { useState } from 'react';
import { fmt } from '../../core/num';
import { balanceMerit } from './merit';
import { module06 } from './roadmap';

const sample = module06.merit;
const toInput = (value: number) => String(value).replace('.', ',');
const salary = (value: number) => fmt(value, 2);
const sampleInputs = () => sample.cells.map((cell) => ({ payroll: toInput(cell.payroll), rate: toInput(cell.rate) }));

export function MeritPractice() {
  const [cells, setCells] = useState(sampleInputs);
  const [budget, setBudget] = useState(toInput(sample.budget));
  const [months, setMonths] = useState('6');
  const [index, setIndex] = useState(0);
  const numericCells = cells.map((cell) => ({ payroll: read(cell.payroll, 1e9), rate: read(cell.rate, 100) }));
  const budgetRate = read(budget, 100);
  const effectiveMonths = read(months, 12);
  const valid = Number.isFinite(budgetRate)
    && Number.isInteger(effectiveMonths)
    && numericCells.every((cell) => Number.isFinite(cell.payroll) && Number.isFinite(cell.rate));
  const balanced = valid ? balanceMerit(numericCells, budgetRate) : undefined;
  const selected = cells[index];

  function change(field: 'payroll' | 'rate', value: string) {
    setCells((current) => current.map((cell, cellIndex) => cellIndex === index ? { ...cell, [field]: value } : cell));
  }

  return (
    <section className="stack roadmap-review" aria-labelledby="merit-title">
      <h2 className="h-sec" id="merit-title">Thử cân ma trận merit</h2>
      <p>Chọn từng ô để chỉnh quỹ hoặc tỷ lệ gốc. Các số tiền dùng triệu đồng. Mô hình áp dụng cùng hệ số cho mọi ô và giả định chi đủ tháng.</p>
      <div className="merit-inputs">
        <label className="field">
          Ô trong ma trận
          <select value={index} onChange={(e) => setIndex(Number(e.target.value))}>
            {sample.cells.map((cell, i) => <option value={i} key={i}>{cell.rating} · {cell.compa}</option>)}
          </select>
        </label>
        <label className="field">
          Quỹ ô (triệu đồng/tháng)
          <input type="text" inputMode="decimal" value={selected?.payroll ?? ''} onChange={(e) => change('payroll', e.target.value)} />
        </label>
        <label className="field">
          Tỷ lệ gốc (%)
          <input type="text" inputMode="decimal" value={selected?.rate ?? ''} onChange={(e) => change('rate', e.target.value)} />
        </label>
        <label className="field">
          Ngân sách (%)
          <input type="text" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </label>
        <label className="field">
          Số tháng hiệu lực
          <input type="text" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button className="btn ghost" type="button" onClick={() => {
          setCells(sampleInputs());
          setBudget(toInput(sample.budget));
          setMonths('6');
          setIndex(0);
        }}>Khôi phục số liệu mẫu</button>
      </div>
      <div aria-live="polite" className="stack">
        {balanced ? (
          <>
            <p data-testid="merit-summary">Quỹ {fmt(balanced.payroll, 2)} · Tăng gốc {salary(balanced.original)} · Ngân sách {salary(balanced.target)} triệu đồng/tháng.</p>
            {balanced.factor === null ? (
              <p>Cần ít nhất một ô có quỹ và tỷ lệ gốc dương để phân bổ ngân sách.</p>
            ) : (
              <p data-testid="merit-balanced">Hệ số cân {fmt(balanced.factor, 5)}. Sau cân {salary(balanced.target)} triệu/tháng · {salary(balanced.target * 12)} triệu/12 tháng · {salary(balanced.target * effectiveMonths)} triệu/{effectiveMonths} tháng.</p>
            )}
          </>
        ) : (
          <p>Nhập quỹ hợp lệ ở mọi ô, tỷ lệ và ngân sách từ 0–100%, cùng số tháng nguyên từ 0–12.</p>
        )}
      </div>
      {balanced?.factor != null && (
        <ul className="merit-results">
          {sample.cells.map((cell, i) => {
            const row = balanced.rows[i];
            return row && (
              <li key={i}>
                <span>{cell.rating} · {cell.compa}</span>
                <span>{fmt(row.rate, 2)}% · {salary(row.increase)} triệu/tháng</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function read(raw: string, max: number) {
  const text = raw.trim();
  const value = Number(text.replace(',', '.'));
  return /^\d+(?:[.,]\d+)?$/.test(text) && value <= max ? value : NaN;
}
