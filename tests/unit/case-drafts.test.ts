import { expect, it } from 'vitest';
import { StudyDB } from '../../src/core/db';
import { exportBackup, parseBackup } from '../../src/core/backup';
import { caseDraftKeys, draftEnvelope, emptyEquity, readEquity, writeCaseDraft, DraftChanged } from '../../src/core/caseDraft';

it('giữ bản nháp mới hơn khi hai cửa sổ cùng mở và chỉ sao lưu phiếu đã nộp', async () => {
  const store = new StudyDB('draft-version-test');
  try {
    await writeCaseDraft('equity', emptyEquity, undefined, store);
    const first = draftEnvelope((await store.settings.get(caseDraftKeys.equity))?.value)!;
    await writeCaseDraft('equity', { ...emptyEquity, gap: 'E01' }, first.version, store);
    await expect(writeCaseDraft('equity', emptyEquity, first.version, store)).rejects.toThrow(DraftChanged);
    expect(readEquity(draftEnvelope((await store.settings.get(caseDraftKeys.equity))?.value)?.fields)?.gap).toBe('E01');
    expect(parseBackup(await exportBackup(store)).settings.map((s) => s.key)).not.toContain(caseDraftKeys.equity);
  } finally { await store.delete(); }
});
