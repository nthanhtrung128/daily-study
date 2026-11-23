import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../../core/db';
import { readTransfer, type TransferResult } from '../../core/transfer';

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
    const sub = liveQuery(() => db.settings.where('key').startsWith(casePrefix + id + '.').toArray()).subscribe({
      next: (items) => setRows(items.flatMap((item) => readTransfer(item.value) ?? []).sort((a, b) => b.at - a.at)),
      error: () => setRows(null),
    });
    return () => sub.unsubscribe();
  }, [id]);
  return rows;
}
