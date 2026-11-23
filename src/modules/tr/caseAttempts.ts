import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../../core/db';
import { readTransfer, transferPrefix, type TransferResult } from '../../core/transfer';

export type CaseAttempt = TransferResult;
export const casePrefix = 'tr.caseAttempt.';
export function saveCase(id: string, response: string, criteria: boolean[]) {
  const value = readTransfer({ at: Date.now(), response, criteria });
  if (!value) throw new Error('Phiếu chưa hợp lệ.');
  return db.settings.add({ key: casePrefix + id + '.' + crypto.randomUUID(), value });
}

export function useCaseAttempts(id: string) {
  const [rows, setRows] = useState<CaseAttempt[] | null>();
  useEffect(() => {
    const sub = liveQuery(async () => {
      const rows = await db.settings.where('key').startsWith(casePrefix + id + '.').toArray();
      if (id === 'capstone') {
        const current = await db.settings.get(transferPrefix + 'capstone');
        if (current) rows.push(current);
      }
      return rows;
    }).subscribe({
      next: (items) => {
        const attempts = items.flatMap((item) => readTransfer(item.value) ?? []);
        const unique = new Map(attempts.map((r) => [JSON.stringify([r.at, r.response, r.criteria]), r]));
        setRows([...unique.values()].sort((a, b) => b.at - a.at));
      },
      error: () => setRows(null),
    });
    return () => sub.unsubscribe();
  }, [id]);
  return rows;
}
