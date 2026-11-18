export interface MeritCell {
  payroll: number;
  rate: number;
}

export function balanceMerit(cells: readonly MeritCell[], budgetRate: number) {
  const payroll = cells.reduce((sum, cell) => sum + cell.payroll, 0);
  const original = cells.reduce((sum, cell) => sum + cell.payroll * cell.rate / 100, 0);
  const target = payroll * budgetRate / 100;
  const factor = original ? target / original : target ? null : 0;
  return {
    payroll,
    original,
    target,
    factor,
    rows: factor === null ? [] : cells.map((cell) => ({
      rate: cell.rate * factor,
      increase: cell.payroll * cell.rate / 100 * factor,
    })),
  };
}
