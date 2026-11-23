import { db, type StudyDB } from './db';

export const caseDraftKeys = { equity: 'tr.caseDraft.equity', offers: 'tr.caseDraft.offers' } as const;
export type CaseId = keyof typeof caseDraftKeys;
export const emptyEquity = { selected: [] as string[], gap: '', checks: ['', '', ''], spoken: '' };
export const emptyOffers = { numbers: ['', '', '', '', '', ''], choice: '', reason: '', question: '', spoken: '' };

function strings(v: unknown, n: number, max: number): v is string[] {
  return Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'string' && x.length <= max);
}
function oneOf(v: unknown, options: string[]): v is string {
  return typeof v === 'string' && options.includes(v);
}
export function readEquity(v: unknown): typeof emptyEquity | undefined {
  if (!v || typeof v !== 'object') return;
  const d = v as Partial<typeof emptyEquity>;
  if (Array.isArray(d.selected) && d.selected.length <= 7 && d.selected.every((x) => typeof x === 'string' && /^E0[2-8]$/.test(x)) &&
    new Set(d.selected).size === d.selected.length && strings(d.checks, 3, 350) && oneOf(d.gap, ['', 'E01', 'E06', 'E08']) &&
    oneOf(d.spoken, ['', 'Đã giải thích được', 'Cần luyện thêm'])) return { selected: d.selected, checks: d.checks, gap: d.gap, spoken: d.spoken };
}
export function readOffers(v: unknown): typeof emptyOffers | undefined {
  if (!v || typeof v !== 'object') return;
  const d = v as Partial<typeof emptyOffers>;
  if (strings(d.numbers, 6, 10) && oneOf(d.choice, ['', 'A', 'B']) && typeof d.reason === 'string' && d.reason.length <= 600 &&
    typeof d.question === 'string' && d.question.length <= 350 && oneOf(d.spoken, ['', 'Đã hỏi được', 'Cần luyện thêm'])) {
    return { numbers: d.numbers, choice: d.choice, reason: d.reason, question: d.question, spoken: d.spoken };
  }
}

export function draftEnvelope(v: unknown) {
  if (v && typeof v === 'object' && 'version' in v && typeof v.version === 'string' && 'fields' in v) return { version: v.version, fields: v.fields };
}
export class DraftChanged extends Error {}
export async function writeCaseDraft(id: CaseId, fields: typeof emptyEquity | typeof emptyOffers, version?: string, store: StudyDB = db) {
  const key = caseDraftKeys[id];
  await store.transaction('rw', store.settings, async () => {
    const current = draftEnvelope((await store.settings.get(key))?.value);
    if (version !== current?.version) throw new DraftChanged();
    await store.settings.put({ key, value: { fields, version: crypto.randomUUID() } });
  });
}
