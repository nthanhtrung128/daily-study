import { compaRatio, rangePenetration } from './calc';

export interface SalarySample {
  id: string;
  family: string;
  grade: string;
  fte: number;
  salary: number;
  min: number;
  midpoint: number;
  max: number;
  market: number;
}

export function analyzeSalary(row: SalarySample) {
  const perFte = row.salary / row.fte;
  const normalized = row.fte > 0 && Number.isFinite(perFte) ? perFte : null;
  const compa = normalized !== null && row.midpoint > 0 ? compaRatio(normalized, row.midpoint) : null;
  const hasRange = normalized !== null && row.min > 0 && row.max > row.min;
  const penetration = hasRange ? rangePenetration(normalized, row.min, row.max) : null;
  const marketRatio = normalized !== null && row.market > 0 ? normalized / row.market : null;
  const position = !hasRange ? 'Kiểm tra dữ liệu'
    : normalized < row.min ? 'Dưới min'
    : normalized > row.max ? 'Trên max'
    : 'Trong dải';

  return { ...row, normalized, compa, penetration, marketRatio, position };
}

export function summarizeSalary(rows: ReturnType<typeof analyzeSalary>[]) {
  let eligible = 0;
  let normalized = 0;
  let midpoint = 0;
  let compa = 0;
  let below = 0;
  let above = 0;

  for (const row of rows) {
    if (row.position === 'Dưới min') below++;
    if (row.position === 'Trên max') above++;
    if (row.compa !== null && row.normalized !== null) {
      eligible++;
      normalized += row.normalized;
      midpoint += row.midpoint;
      compa += row.compa;
    }
  }

  return {
    eligible, below, above,
    groupCompa: eligible ? normalized / midpoint : null,
    averageCompa: eligible ? compa / eligible : null,
  };
}
