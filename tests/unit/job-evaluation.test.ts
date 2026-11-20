import { expect, it } from 'vitest';
import { evaluateJob, evaluation, jobGrade } from '../../src/modules/tr/jobEvaluation';

it('khớp cả năm hồ sơ Excel và bốn trọng số cộng thành 100', () => {
  expect(evaluation.factors.map((f) => f.weight)).toEqual([25, 25, 35, 15]);
  expect(evaluation.factors.every((f) => f.anchors.length === 5 && f.anchors.every(Boolean))).toBe(true);
  expect(evaluation.profiles.map((p) => evaluateJob(p.levels).total)).toEqual([53, 53, 78, 73, 87]);
  expect(evaluateJob([5, 5, 5, 5])).toMatchObject({ total: 100, grade: 'G4' });
});

it('chuyển ngạch ngay tại ranh giới 45, 60, 75 và phát hiện cấp sai', () => {
  expect([44, 45, 59, 60, 74, 75].map(jobGrade)).toEqual(['G1', 'G2', 'G2', 'G3', 'G3', 'G4']);
  expect(() => evaluateJob([0, 3, 3, 3])).toThrow();
});
