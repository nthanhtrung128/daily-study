import { afterEach, beforeEach, expect, it } from 'vitest';
import { StudyDB } from '../../src/core/db';
import { addDays } from '../../src/core/date';
import { readAttempt, reviewPlan, saveCourseReview, type Attempt } from '../../src/core/courseReview';

const store = new StudyDB('test-course-review');
beforeEach(async () => { await store.open(); });
afterEach(() => store.delete());

it('hai tab chấm cùng buổi chỉ ghi một lượt; khi đến hạn, đánh giá lại thay đổi lịch', async () => {
  const save = (date: string, understood: boolean) =>
    saveCourseReview('M01', [1, 2], [1, 2], 'So sánh lịch làm việc và cơ hội lên cấp.', understood, new Date(date + 'T12:00:00'), store);
  const [first, duplicate] = await Promise.all([save('2026-11-20', true), save('2026-11-20', true)]);
  expect(first).toEqual(duplicate);
  expect(first.due).toBe('2026-11-21');
  expect(await store.reviews.count()).toBe(1);
  expect(await store.days.get('2026-11-20')).toMatchObject({ n: 1, ok: 1 });
  expect((await save('2026-11-21', true)).due).toBe('2026-11-24');
  expect((await save('2026-11-22', false)).due).toBe('2026-11-24');
  expect((await save('2026-11-24', false)).due).toBe('2026-11-25');
  expect(readAttempt({ choices: 'AB' })).toBeUndefined();
});

it('mỗi ngày một buổi vẫn đi qua cả 17 mô-đun và quay lại cả buổi đã vững', async () => {
  const modules = Array.from({ length: 17 }, (_, i) => 'M' + String(i + 1).padStart(2, '0'));
  const attempts = new Map<string, Attempt>();
  const counts = new Map<string, number>();
  for (let i = 0; i < 180; i++) {
    const day = addDays('2026-11-20', i);
    const { next } = reviewPlan(modules, attempts, day);
    if (!next) continue;
    const attempt = await saveCourseReview(next, [1, 2], next === 'M01' ? [0, 2] : [1, 2], 'Bằng chứng.', true, new Date(day + 'T12:00:00'), store);
    attempts.set(next, attempt);
    counts.set(next, (counts.get(next) ?? 0) + 1);
  }
  expect(counts.size).toBe(17);
  expect(Math.min(...counts.values())).toBeGreaterThanOrEqual(5);
  expect(attempts.get('M01')?.box).toBe(1);
  const plan = reviewPlan(['M01'], attempts, '2026-11-20');
  expect(plan.next).toBeUndefined();
  expect(plan.nextDate).toBe(attempts.get('M01')?.due);
});
