import module07 from '../../../content/tr-roadmap/m07.json';

export const samplePool = module07.bonusPool;

export interface BonusInput {
  id: string;
  target: string;
  eligible: string;
  factor: string;
}

export function samplePeople(): BonusInput[] {
  return samplePool.people.map(({ id, target, eligible, factor }) => ({
    id, target: String(target), eligible: String(eligible), factor: String(factor).replace('.', ','),
  }));
}

// Quy về phần trăm của đơn vị nhập trước khi tính để các phần dư bằng nhau luôn xếp cùng hạng.
function hundredths(raw: string) {
  const parts = /^(\d{1,7})(?:[,.](\d{1,2}))?$/.exec(raw.trim());
  if (!parts) return;
  return BigInt(parts[1]!) * 100n + BigInt((parts[2] ?? '').padEnd(2, '0'));
}

export function allocateBonus(budgetText: string, people: readonly BonusInput[]) {
  const budget = hundredths(budgetText);
  if (budget === undefined) return { error: 'Kiểm tra quỹ thưởng. Nhập số không âm, tối đa 7 chữ số phần nguyên và 2 chữ số thập phân.' };
  const weights: bigint[] = [];
  for (const person of people) {
    const target = hundredths(person.target);
    const eligible = hundredths(person.eligible);
    const factor = hundredths(person.factor);
    if (target === undefined || eligible === undefined || eligible > 10000n || factor === undefined) {
      return { error: 'Kiểm tra ' + person.id + '. Mục tiêu và hệ số phải không âm, thời gian từ 0 đến 100%. Mỗi số có tối đa 7 chữ số phần nguyên và 2 chữ số thập phân.' };
    }
    weights.push(target * eligible * factor);
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0n);
  const rows = weights.map((weight, i) => {
    const product = budget * weight;
    return { id: people[i]!.id, points: Number(weight) / 1e8,
      share: totalWeight ? Number(weight) / Number(totalWeight) * 100 : 0,
      units: totalWeight ? product / totalWeight : 0n,
      remainder: totalWeight ? product % totalWeight : 0n };
  });
  if (totalWeight) {
    const left = Number(budget - rows.reduce((sum, row) => sum + row.units, 0n));
    // Mỗi suất nhận phần nguyên trước. Chia phần lẻ theo dư lớn nhất, trùng dư theo thứ tự hồ sơ.
    const ranked = rows.slice().sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : 0);
    for (const row of ranked.slice(0, left)) row.units += 1n;
  }
  const paid = rows.reduce((sum, row) => sum + row.units, 0n);
  return { rows: rows.map(({ id, points, share, units }) => ({ id, points, share, amount: Number(units) / 100 })),
    points: Number(totalWeight) / 1e8, paid: Number(paid) / 100, unallocated: Number(budget - paid) / 100 };
}
