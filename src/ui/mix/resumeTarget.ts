import type { Grade } from '../../core/leitner';
import { restoreSession, type ActiveSession, type SavedItem } from '../../core/resume';
import { ITEMS, type TrItem } from '../../modules/tr/items';
import { EN_ITEMS, type EnItem } from '../../modules/english/content';
import { SAY_ITEMS, type SayItem } from '../../modules/english/speech/sayItems';
import { SPEAKING_TOPICS } from '../../modules/english/speech/topics';
import type { DailyEntry } from '../../modules/mix/plan';
import type { DailyResult } from '../../modules/mix/result';
import type { EnView } from '../../modules/english/ui/EnglishScreen';

/** Phiên dở đã dựng lại từ id (mục không còn trong nội dung đã bỏ qua). */
export type ResumeTarget =
  | { kind: 'mix'; entries: DailyEntry[]; pos: number; results: DailyResult[]; t0: number; minutes: number }
  | { kind: 'tr'; list: TrItem[]; pos: number; results: { it: TrItem; g: Grade }[]; t0: number; minutes: number }
  | { kind: 'en'; view: EnView };

export interface Resumable {
  target: ResumeTarget;
  done: number;
  total: number;
}

const byId = <T extends { id: string }>(xs: readonly T[]) => new Map(xs.map((x) => [x.id, x]));
const TIERS = new Set(['due', 'wrong', 'new']);

function mixEntry(s: SavedItem, tr: Map<string, TrItem>, en: Map<string, EnItem>, say: Map<string, SayItem>): DailyEntry | undefined {
  const secs = s.secs ?? 30;
  if (s.tier === 'extra') {
    if (s.id.startsWith('topic:')) {
      const topic = SPEAKING_TOPICS.find((t) => `topic:${t.id}` === s.id);
      return topic ? { lane: 'en', tier: 'extra', secs, item: { kind: 'topic', id: s.id, topic } } : undefined;
    }
    const item = say.get(s.id);
    return item ? { lane: 'en', tier: 'extra', secs, item: { kind: 'say', id: s.id, item } } : undefined;
  }
  const tier = (TIERS.has(s.tier ?? '') ? s.tier : 'due') as 'due' | 'wrong' | 'new';
  if (s.lane === 'tr') {
    const item = tr.get(s.id);
    return item ? { lane: 'tr', tier, secs, item } : undefined;
  }
  const item = en.get(s.id);
  return item ? { lane: 'en', tier, secs, item } : undefined;
}

const graded = <T>(rs: { item: T; g: Grade | null }[]) => rs.flatMap((r) => (r.g === null ? [] : [{ it: r.item, g: r.g }]));

export function resolveActive(s: ActiveSession, now: number): Resumable | null {
  if (s.kind === 'mix') {
    const tr = byId(ITEMS);
    const en = byId(EN_ITEMS);
    const say = byId(SAY_ITEMS);
    const r = restoreSession(s, (it) => mixEntry(it, tr, en, say), now);
    if (!r) return null;
    const results = r.results.map((x) => ({ entry: x.item, g: x.g, ...(x.score !== undefined ? { score: x.score } : {}) }));
    return { target: { kind: 'mix', entries: r.list, pos: r.pos, results, t0: r.t0, minutes: s.minutes }, done: r.pos, total: r.list.length };
  }
  if (s.kind === 'tr') {
    const tr = byId(ITEMS);
    const r = restoreSession(s, (it) => tr.get(it.id), now);
    if (!r) return null;
    return { target: { kind: 'tr', list: r.list, pos: r.pos, results: graded(r.results), t0: r.t0, minutes: s.minutes }, done: r.pos, total: r.list.length };
  }
  if (s.kind === 'speak') {
    const say = byId(SAY_ITEMS);
    const r = restoreSession(s, (it) => say.get(it.id), now);
    if (!r) return null;
    const done = r.results.flatMap((x) => (x.g === null ? [] : [{ it: x.item, g: x.g, score: x.score ?? null }]));
    return { target: { kind: 'en', view: { kind: 'speak', list: r.list, t0: r.t0, pos: r.pos, done } }, done: r.pos, total: r.list.length };
  }
  const type = s.kind === 'en-phrase' ? 'phrase' : 'pattern';
  const en = byId(EN_ITEMS);
  const r = restoreSession(s, (it) => {
    const v = en.get(it.id);
    return v && v.type === type ? v : undefined;
  }, now);
  if (!r) return null;
  return {
    target: { kind: 'en', view: { kind: 'cards', type, list: r.list, t0: r.t0, minutes: s.minutes, pos: r.pos, done: graded(r.results) } },
    done: r.pos,
    total: r.list.length,
  };
}
