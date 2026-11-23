// Lương và chi phí tính bằng triệu đồng. Các đầu vào UI giới hạn đến hai chữ số thập phân.
export const monthlyBase = 20;
export const yearLimit = 120;

export function readAmount(value: string) {
  const trimmed = value.trim();
  return /^\d{1,7}([.,]\d{1,2})?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : undefined;
}

export function raiseBudget(people: number, rate: number, month: number) {
  if (!Number.isInteger(people) || people < 0 || people > 10000 || !Number.isFinite(rate) || rate < 0 || rate > 100
    || !Number.isInteger(month) || month < 1 || month > 12) return;
  // Một đơn vị = 100 đồng. Lương 20 triệu × 0,01% = 20 đơn vị.
  const units = people * monthlyBase * Math.round(rate * 100);
  return { months: 13 - month, year: units * (13 - month) / 10000, full: units * 12 / 10000 };
}
