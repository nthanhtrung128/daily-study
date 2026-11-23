import { addDays, dayKey } from './date';
import { db, type Setting, type StudyDB } from './db';
import { readTransfer, transferPrefix } from './transfer';

const sourceSkills = {
  capstone: ['scope', 'budget', 'decision'],
  7: ['scope', 'freshness', 'retention'],
  30: ['inYear', 'full', 'assumptions'],
} as const;
export type Skill = typeof sourceSkills[keyof typeof sourceSkills][number];
export const drillPrefix = 'tr.skillDrill.';
export const drillKeys = [...Object.keys(sourceSkills).map((k) => transferPrefix + k),
  ...new Set(Object.values(sourceSkills).flat().map((s) => drillPrefix + s))];
type DrillResult = { at: number; sourceAt: number; index: number; correct: boolean };
export type Drill = { skill: Skill; source: string; sourceAt: number; due: string; index: number };

export function readDrill(value: unknown): DrillResult | undefined {
  if (!value || typeof value !== 'object') return;
  const r = value as Partial<DrillResult>;
  if (typeof r.at === 'number' && Number.isFinite(r.at) && r.at > 0 && typeof r.sourceAt === 'number' &&
    Number.isFinite(r.sourceAt) && r.sourceAt > 0 && typeof r.index === 'number' && Number.isSafeInteger(r.index) &&
    r.index >= 0 && typeof r.correct === 'boolean') return r as DrillResult;
}

export function drillSchedule(rows: (Setting | undefined)[]): Drill[] {
  const values = new Map(rows.flatMap((r) => r ? [[r.key, r.value] as const] : []));
  const bySkill = new Map<Skill, { at: number; ok: boolean; source: string }>();
  for (const [source, skills] of Object.entries(sourceSkills)) {
    const attempt = readTransfer(values.get(transferPrefix + source));
    if (!attempt) continue;
    skills.forEach((skill, i) => {
      if (attempt.at >= (bySkill.get(skill)?.at ?? 0)) bySkill.set(skill, { at: attempt.at, ok: attempt.criteria[i]!, source });
    });
  }
  const queue: Drill[] = [];
  for (const [skill, evidence] of bySkill) {
    if (evidence.ok) continue;
    const saved = readDrill(values.get(drillPrefix + skill));
    const last = saved?.sourceAt === evidence.at ? saved : undefined;
    if (last?.correct) continue;
    queue.push({ skill, source: evidence.source, sourceAt: evidence.at,
      due: addDays(dayKey(new Date(last?.at ?? evidence.at)), 1), index: last ? last.index + 1 : 0 });
  }
  return queue.sort((a, b) => a.due.localeCompare(b.due) || a.skill.localeCompare(b.skill));
}

export function finishDrill(drill: Drill, correct: boolean, now = new Date(), store: StudyDB = db) {
  return store.transaction('rw', store.settings, store.reviews, store.days, async () => {
    const current = drillSchedule(await store.settings.bulkGet(drillKeys)).find((d) => d.skill === drill.skill);
    const day = dayKey(now);
    if (!current || current.sourceAt !== drill.sourceAt || current.index !== drill.index || day < current.due) return false;
    const at = now.getTime();
    const itemId = drillPrefix + drill.skill;
    await store.settings.put({ key: itemId, value: { at, sourceAt: drill.sourceAt, index: drill.index, correct } });
    await store.reviews.add({ itemId, at, day, grade: correct ? 2 : 0 });
    const stats = await store.days.get(day) ?? { day, n: 0, ok: 0, s: 0 };
    await store.days.put({ ...stats, n: stats.n + 1, ok: stats.ok + Number(correct) });
    return true;
  });
}
