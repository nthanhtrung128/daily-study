import { expect, it } from 'vitest';
import { StudyDB } from '../../src/core/db';
import { applyBackup, exportBackup, parseBackup } from '../../src/core/backup';
import { anchorDay, readTransfer, saveTransfer, startTransfer, transferAnchor } from '../../src/core/transfer';

it('giữ mốc người đã học từ bản cũ, chặn lượt sớm và chỉ ghi một lần khi gửi đồng thời', async () => {
  const store = new StudyDB('transfer-regression');
  try {
    const older = parseBackup(await exportBackup(store));
    await startTransfer('2026-11-23', store);
    await startTransfer('2026-11-24', store);
    expect((await store.settings.get(transferAnchor))?.value).toBe('2026-11-23');
    const submit = (day: string) => saveTransfer(7, 'Kiểm tra phạm vi.', [true, false, false], new Date(day + 'T12:00:00'), store);
    await expect(submit('2026-11-29')).rejects.toThrow('chưa đến hạn');
    await Promise.all([submit('2026-11-30'), submit('2026-11-30')]);
    expect(await store.reviews.count()).toBe(1);
    expect((await store.days.get('2026-11-30'))?.n).toBe(1);
    expect(readTransfer((await store.settings.get('tr.transfer.7'))?.value)?.criteria).toEqual([true, false, false]);
    expect(anchorDay('2026-02-30')).toBeUndefined();
    const backup = parseBackup(await exportBackup(store));
    await applyBackup(older, 'replace', store);
    expect(await store.settings.get(transferAnchor)).toBeUndefined();
    expect(await store.settings.get('tr.transfer.7')).toBeUndefined();
    await startTransfer('2026-12-31', store);
    await applyBackup(backup, 'merge', store);
    expect((await store.settings.get(transferAnchor))?.value).toBe('2026-11-23');
    expect(readTransfer((await store.settings.get('tr.transfer.7'))?.value)?.response).toBe('Kiểm tra phạm vi.');
  } finally { await store.delete(); }
});
