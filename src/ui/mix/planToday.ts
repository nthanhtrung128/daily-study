import type { Progress } from '../../core/progress';
import type { DailyPrefs } from '../../core/prefs';
import { seeded } from '../../core/rng';
import { planDaily, type DailyPlan } from '../../modules/mix/plan';

/** Seed ổn định trong ngày (đổi sau mỗi lượt ôn) — xem trước và phiên thật ra cùng một danh sách. */
export function daySeed(today: string, n: number): number {
  let h = 2166136261;
  for (const ch of `${today}#${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function planToday(p: Progress, prefs: DailyPrefs, minutes?: number): DailyPlan {
  const today = p.today();
  return planDaily(prefs, p.stateOf, today, {
    newToday: p.newToday(),
    rng: seeded(daySeed(today, p.dayStat(today).n)),
    ...(minutes !== undefined ? { minutes } : {}),
  });
}

