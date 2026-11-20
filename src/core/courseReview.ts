import { db, type StudyDB } from './db';
import { dayKey } from './date';
import { applyGrade, type LeitnerState } from './leitner';

export const COURSE_REVIEW_PREFIX = 'tr.courseReview.';

export interface Attempt extends LeitnerState {
  choices: number[];
  response: string;
  understood: boolean;
  first: boolean;
}

export function readAttempt(value: unknown): Attempt | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as Partial<Attempt>;
  if (!Array.isArray(v.choices) || v.choices.length !== 2
    || !v.choices.every((i) => Number.isInteger(i) && i >= 0 && i < 4)
    || typeof v.response !== 'string' || !v.response.trim() || v.response.length > 2000
    || typeof v.understood !== 'boolean' || typeof v.first !== 'boolean'
    || typeof v.box !== 'number' || !Number.isInteger(v.box) || v.box < 1 || v.box > 5
    || typeof v.due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.due)
    || typeof v.wrong !== 'number' || !Number.isInteger(v.wrong) || v.wrong < 0
    || typeof v.last !== 'number' || !Number.isFinite(v.last) || v.last <= 0) return;
  return v as Attempt;
}

export function reviewPlan(codes: string[], attempts: ReadonlyMap<string, Attempt>, today: string) {
  const unseen = codes.find((code) => !attempts.has(code));
  const studied = codes.flatMap((code) => {
    const attempt = attempts.get(code);
    return attempt ? [{ code, attempt }] : [];
  });
  const latest = studied.reduce<typeof studied[number] | undefined>((last, row) =>
    !last || row.attempt.last > last.attempt.last ? row : last, undefined);
  studied.sort((a, b) => a.attempt.due.localeCompare(b.attempt.due) || a.attempt.last - b.attempt.last);
  const earliest = studied[0];
  const due = earliest && earliest.attempt.due <= today ? earliest.code : undefined;
  // Luân phiên giữa buổi chưa thử và buổi đến hạn để người chỉ ôn một buổi/ngày vẫn đi hết khóa.
  return { next: latest?.attempt.first ? due ?? unseen : unseen ?? due, nextDate: earliest?.attempt.due };
}

export function saveCourseReview(code: string, answerKey: number[], choices: number[], response: string,
  understood: boolean, now = new Date(), store: StudyDB = db) {
  const at = now.getTime();
  const day = dayKey(now);
  const key = COURSE_REVIEW_PREFIX + code;
  return store.transaction('rw', store.settings, store.days, store.reviews, async () => {
    const prev = readAttempt((await store.settings.get(key))?.value);
    // Hai lần gửi cùng lúc hoặc xem lại trước hạn chỉ tính một lượt.
    if (prev && prev.due > day) return prev;
    const mastered = understood && answerKey.length === choices.length && choices.every((v, i) => v === answerKey[i]);
    const grade = mastered ? 2 : 1;
    const attempt = { ...applyGrade(prev, grade, day, at), choices, response: response.trim(), understood, first: !prev };
    if (!readAttempt(attempt)) throw new Error('Lượt tự kiểm tra chưa đủ câu trả lời.');
    await store.settings.put({ key, value: attempt });
    await store.reviews.add({ itemId: key, day, grade, at });
    const stats = await store.days.get(day) ?? { day, n: 0, ok: 0, s: 0 };
    await store.days.put({ ...stats, n: stats.n + 1, ok: stats.ok + Number(mastered) });
    return attempt;
  });
}
