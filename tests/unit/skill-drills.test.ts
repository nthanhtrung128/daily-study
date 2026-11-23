import { expect, it } from 'vitest';
import { StudyDB } from '../../src/core/db';
import { drillKeys, drillSchedule, finishDrill } from '../../src/core/skillDrills';
import { applyBackup, exportBackup, parseBackup } from '../../src/core/backup';
import { drillQuestion, matchesQuestion } from '../../src/modules/tr/drillQuestions';
it('chỉ hẹn tiêu chí yếu, đổi câu sau lượt sai, chống ghi trùng và giữ lịch qua sao lưu', async () => {
  const store = new StudyDB('drill-regression');
  const date = (d: number) => new Date(2026, 10, d, 12);
  const schedule = async () => drillSchedule(await store.settings.bulkGet(drillKeys));
  try {
    const empty = parseBackup(await exportBackup(store));
    await store.settings.put({ key: 'tr.transfer.30', value: { at: +date(12), response: 'Bản đề xuất', criteria: [true, false, true] } });
    const [first] = await schedule();
    expect(first).toMatchObject({ skill: 'full', due: '2026-11-13', index: 0 });
    expect(await finishDrill(first!, false, date(12), store)).toBe(false);
    expect(await Promise.all([finishDrill(first!, false, date(13), store), finishDrill(first!, false, date(13), store)])).toEqual([true, false]);
    const [again] = await schedule();
    expect(again).toMatchObject({ skill: 'full', due: '2026-11-14', index: 1 });
    expect(drillQuestion('full', 1).prompt).not.toBe(drillQuestion('full', 0).prompt);
    expect(matchesQuestion(drillQuestion('full', 0), '144,0')).toBe(true);
    expect(await finishDrill(again!, true, date(14), store)).toBe(true);
    expect(await schedule()).toEqual([]);
    const backup = parseBackup(await exportBackup(store));
    await applyBackup(empty, 'replace', store);
    expect(await store.settings.get('tr.skillDrill.full')).toBeUndefined();
    await applyBackup(backup, 'merge', store);
    expect(await schedule()).toEqual([]);
    expect(await store.reviews.count()).toBe(2);
  } finally { await store.delete(); }
});
