import { useState } from 'react';
import { fmt } from '../../core/num';
import { module09 } from './roadmap';
import { analyzeSalary, summarizeSalary } from './salaryAnalysis';

const sample = module09.sample;
const grades = [...new Set(sample.map((row) => row.grade))];
const families = [...new Set(sample.map((row) => row.family))];
const percent = (value: number | null, scale = 100) => value === null ? '—' : `${fmt(value * scale, 2)}%`;
const amount = (value: number | null) => value === null ? '—' : fmt(value, 2);

type Edits = Partial<Record<string, Partial<Record<'fte' | 'midpoint', string>>>>;

export function SalaryAnalysisPractice() {
  const [grade, setGrade] = useState('');
  const [family, setFamily] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [edits, setEdits] = useState<Edits>({});
  const rows = sample.filter((row) => (!grade || row.grade === grade) && (!family || row.family === family))
    .map((row) => analyzeSalary({
      ...row,
      fte: readEdit(edits[row.id]?.fte, row.fte, 1),
      midpoint: readEdit(edits[row.id]?.midpoint, row.midpoint, 1e6),
    }));
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  const summary = summarizeSalary(rows);

  function change(id: string, field: 'fte' | 'midpoint', value: string) {
    setEdits((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }

  return (
    <section className="stack roadmap-review" aria-labelledby="salary-analysis-title">
      <h2 className="h-sec" id="salary-analysis-title">Phân tích bảng lương mẫu</h2>
      <p>Lọc 12 hồ sơ giả định theo grade hoặc họ nghề. Mở NV04 để thấy lương 10 triệu ở 0,5 FTE được quy đổi thành 20 triệu ở 1 FTE. Có thể sửa FTE hoặc xóa midpoint để thử ảnh hưởng lên tập tính compa.</p>
      <div className="roadmap-fields">
        <label className="field">
          Grade
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Mọi grade</option>
            {grades.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="field">
          Họ nghề
          <select value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="">Mọi họ nghề</option>
            {families.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <div className="stack" aria-live="polite">
        <p data-testid="salary-coverage">
          {summary.eligible}/{rows.length} hồ sơ đủ dữ liệu tính compa · {summary.below} dưới min · {summary.above} trên max
        </p>
        <dl className="salary-metrics" data-testid="salary-group">
          <div><dt>Compa theo quỹ</dt><dd>{percent(summary.groupCompa)}</dd></div>
          <div><dt>Trung bình compa cá nhân</dt><dd>{percent(summary.averageCompa)}</dd></div>
        </dl>
      </div>
      {selected ? (
        <>
          <label className="field roadmap-fields">
            Hồ sơ mẫu
            <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
              {rows.map((row) => <option key={row.id} value={row.id}>{row.id} · {row.grade} · {row.family}</option>)}
            </select>
          </label>
          <p className="hint">Đơn vị lương và dải là triệu đồng/tháng. FTE hợp lệ lớn hơn 0 và tối đa 1 trong bài mẫu.</p>
          <div className="roadmap-fields">
            <label className="field">
              FTE
              <input type="text" inputMode="decimal" value={edits[selected.id]?.fte ?? String(selected.fte).replace('.', ',')}
                onChange={(e) => change(selected.id, 'fte', e.target.value)} />
            </label>
            <label className="field">
              Midpoint tại 1 FTE
              <input type="text" inputMode="decimal" value={edits[selected.id]?.midpoint ?? String(selected.midpoint).replace('.', ',')}
                onChange={(e) => change(selected.id, 'midpoint', e.target.value)} />
            </label>
          </div>
          <p>Lương thực trả <strong>{amount(selected.salary)}</strong> · Min <strong>{amount(selected.min)}</strong> · Max <strong>{amount(selected.max)}</strong> · Thị trường <strong>{amount(selected.market)}</strong></p>
          <dl className="salary-metrics" data-testid="salary-detail">
            <div><dt>Lương quy đổi 1 FTE</dt><dd>{selected.normalized === null ? '—' : `${amount(selected.normalized)} triệu`}</dd></div>
            <div><dt>Vị trí trong dải</dt><dd>{selected.position}</dd></div>
            <div><dt>Compa-ratio</dt><dd>{percent(selected.compa)}</dd></div>
            <div><dt>Range penetration</dt><dd>{percent(selected.penetration, 1)}</dd></div>
            <div><dt>Market ratio</dt><dd>{percent(selected.marketRatio)}</dd></div>
          </dl>
          {selected.compa === null && <p role="status">Hồ sơ này được bỏ khỏi cả tử và mẫu khi tính compa theo quỹ. Kiểm tra FTE và midpoint.</p>}
        </>
      ) : (
        <p>Tổ hợp grade và họ nghề này chưa có hồ sơ mẫu. Hãy đổi bộ lọc.</p>
      )}
      <div className="row">
        <button className="btn ghost" type="button" onClick={() => {
          setGrade('');
          setFamily('');
          setSelectedId('');
          setEdits({});
        }}>Khôi phục bảng mẫu</button>
      </div>
    </section>
  );
}

function readEdit(raw: string | undefined, fallback: number, max: number) {
  if (raw === undefined) return fallback;
  const text = raw.trim();
  const value = Number(text.replace(',', '.'));
  return /^\d+(?:[.,]\d+)?$/.test(text) && value <= max ? value : 0;
}
