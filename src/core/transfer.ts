import { addDays, dayKey } from './date';
import { db, type StudyDB } from './db';

export const transferPrefix = 'tr.transfer.';
export const transferAnchor = transferPrefix + 'start';
export type TransferDay = 7 | 30;
export type TransferResult = { at: number; response: string; criteria: boolean[] };

export function anchorDay(v: unknown): string | undefined {
  return typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && dayKey(new Date(v + 'T12:00:00')) === v ? v : undefined;
}

export function readTransfer(v: unknown): TransferResult | undefined {
  if (!v || typeof v !== 'object') return;
  const r = v as Partial<TransferResult>;
  if (typeof r.at !== 'number' || !Number.isFinite(r.at) || r.at <= 0 || typeof r.response !== 'string'
    || !r.response.trim() || r.response.length > 2000 || !Array.isArray(r.criteria) || r.criteria.length !== 3
    || !r.criteria.every((c) => typeof c === 'boolean')) return;
  return r as TransferResult;
}

export async function startTransfer(today = dayKey(), store = db) {
  return store.transaction('rw', store.settings, async () => {
    if (!anchorDay((await store.settings.get(transferAnchor))?.value)) await store.settings.put({ key: transferAnchor, value: today });
  });
}

export function saveTransfer(offset: TransferDay, response: string, criteria: boolean[], now = new Date(), store: StudyDB = db) {
  const key = transferPrefix + offset;
  const attempt = readTransfer({ at: now.getTime(), response: response.trim(), criteria });
  if (!attempt) throw new Error('Kiểm tra câu trả lời và ba tiêu chí.');
  return store.transaction('rw', store.settings, store.reviews, store.days, async () => {
    if (readTransfer((await store.settings.get(key))?.value)) return;
    const start = anchorDay((await store.settings.get(transferAnchor))?.value);
    const day = dayKey(now);
    if (!start || day < addDays(start, offset)) throw new Error('Tình huống chưa đến hạn.');
    const grade = criteria.every(Boolean) ? 2 : criteria.some(Boolean) ? 1 : 0;
    await store.settings.put({ key, value: attempt });
    await store.reviews.add({ itemId: key, at: attempt.at, day, grade });
    const stats = await store.days.get(day) ?? { day, n: 0, ok: 0, s: 0 };
    await store.days.put({ ...stats, n: stats.n + 1, ok: stats.ok + Number(grade === 2) });
  });
}
