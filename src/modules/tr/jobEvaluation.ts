import module04 from '../../../content/tr-roadmap/m04.json';

export const evaluation = module04.evaluation;

export function jobGrade(points: number) {
  if (points < 45) return 'G1';
  if (points < 60) return 'G2';
  if (points < 75) return 'G3';
  return 'G4';
}

export function evaluateJob(levels: readonly number[]) {
  const points = evaluation.factors.map((factor, i) => {
    const level = levels[i];
    if (level === undefined || !Number.isInteger(level) || level < 1 || level > 5) {
      throw new Error('Mỗi yếu tố cần một cấp từ 1 đến 5.');
    }
    return factor.weight * level / 5;
  });
  const total = points.reduce((sum, point) => sum + point, 0);
  return { points, total, grade: jobGrade(total) };
}
