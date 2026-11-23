import { describe, expect, it } from 'vitest';
import { communicationKey, latestComparison, learningPath, sessions } from '../../src/modules/english/communication';
import { appUrl, buildIcs, ICS_UID } from '../../src/core/ics';
import type { LeitnerState } from '../../src/core/leitner';

describe('Lộ trình giao tiếp', () => {
  it('ưu tiên lượt đến hạn từ ngày trước, luân chuyển sang bài mới sau một lượt quên trong ngày', () => {
    const first = sessions[0]!, second = sessions[1]!;
    const states = new Map<string, LeitnerState>();
    const plan = (day: string) => learningPath((id) => states.get(id), day);
    expect(plan('2026-11-23').next?.lesson).toBe(first);
    states.set(communicationKey(first.id), { box: 1, last: new Date('2026-11-23T12:00:00').getTime(), wrong: 1, due: '2026-11-23' });
    expect(plan('2026-11-23').next?.lesson).toBe(second);
    expect(plan('2026-11-24').next?.lesson).toBe(first);
    for (const l of sessions) states.set(communicationKey(l.id), { box: 4, last: 1, wrong: 0, due: '2026-12-01' });
    expect(plan('2026-11-24')).toMatchObject({ next: undefined, retained: 6, nextDate: '2026-12-01' });
  });

  it('so sánh cùng một bài qua hai ngày và lấy lượt gần nhất của từng ngày', () => {
    const logs = [0, 1, 2].map((grade) => ({ itemId: 'en:cc-01', at: 10 + grade, grade, day: grade === 2 ? '2026-11-23' : '2026-11-21' }));
    expect(latestComparison(logs.slice(0, 2))).toBeUndefined();
    expect(latestComparison(logs)).toMatchObject({ previous: { grade: 1 }, last: { grade: 2 } });
  });

  it('mỗi lời nhắc có UID ổn định, báo đúng câu gợi nhớ và mở đúng bài', () => {
    const opt = { days: [1, 4], time: '20:30', from: '2026-11-23', now: new Date('2026-11-23T10:00:00Z') };
    const url = appUrl({ protocol: 'https:', host: 'app.test', pathname: '/', hostname: 'app.test' }, '#lo-trinh?giao-tiep=cc-01')!;
    const ics = buildIcs({ ...opt, reminderId: 'cc-01', alarmText: 'Hỏi tiếp thế nào?', url }).replace(/\r\n /g, '');
    expect(ics).toContain('UID:cc-01@daily-study.app');
    expect(ics).toContain('BYDAY=MO,TH');
    expect(ics).toContain('ACTION:DISPLAY\r\nDESCRIPTION:Hỏi tiếp thế nào?');
    expect(ics).toContain('URL:https://app.test/#lo-trinh?giao-tiep=cc-01');
    expect(buildIcs(opt)).toContain('UID:' + ICS_UID);
  });
});
