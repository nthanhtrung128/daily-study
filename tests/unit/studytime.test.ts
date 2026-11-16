import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { StudyDB } from '../../src/core/db';
import { Progress } from '../../src/core/progress';
import { normalizePrefs } from '../../src/core/prefs';
import { streakCount } from '../../src/core/streak';
import { GAP_MS, addStudy, goalMet, lapSecs, studySecs, weekDays, weekStart } from '../../src/core/studytime';
import { delta, mins, weekLabel, weekSummary } from '../../src/modules/progress/week';
import { exportBackup, applyBackup, parseBackup } from '../../src/core/backup';
import type { DayStat } from '../../src/core/db';

let seq = 0;
const freshDb = () => new StudyDB(`studytime-${++seq}`);
const day = (d: Partial<DayStat> & { day: string }): DayStat => ({ n: 0, ok: 0, s: 0, ...d });

describe('cộng dồn thời gian học', () => {
  it('lapSecs bỏ khoảng nghỉ > 2 phút và lượt chưa có mốc', () => {
    expect(lapSecs(null, 5000)).toBe(0);
    expect(lapSecs(1000, 31_000)).toBe(30);
    expect(lapSecs(0, GAP_MS)).toBe(120);
    expect(lapSecs(0, GAP_MS + 1)).toBe(0);
    expect(lapSecs(5000, 1000)).toBe(0);
  });

  it('addStudy cộng theo nhóm và điểm nói', () => {
    let d = day({ day: '2026-11-16' });
    d = addStudy(d, 'tr', 30);
    d = addStudy(d, 'speak', 20, 80);
    d = addStudy(d, 'speak', 10, 60);
    expect(d).toMatchObject({ st: 30, sk: 30, ks: 140, kn: 2 });
    expect(studySecs(d)).toBe(60);
  });

  it('ngày cũ chưa tách nhóm dùng số giây phiên `s`', () => {
    expect(studySecs(day({ day: '2026-11-01', n: 20, s: 600 }))).toBe(600);
    expect(goalMet(day({ day: '2026-11-01', s: 900 }), 15)).toBe(true);
    expect(goalMet(day({ day: '2026-11-01', s: 899 }), 15)).toBe(false);
  });

  it('Progress.grade đo giữa các lượt chấm, tách TR / EN / nói, đếm mục mới thuộc', async () => {
    let now = new Date(2026, 10, 16, 20, 0, 0).getTime();
    const store = freshDb();
    const p = new Progress(store, () => new Date(now));
    await p.load();
    const step = (s: number) => (now += s * 1000);
    p.touch();
    step(20);
    p.grade('tr:K001', 2);
    step(40);
    p.grade('en:ph-0001', 2);
    step(300); // nghỉ 5 phút: không tính
    p.grade('tr:K002', 0);
    step(30);
    p.grade('en:sp-0001', 2, { speak: true, score: 90 });
    step(10);
    p.lap('speak');
    p.addStudy('en', 45);
    const d = p.dayStat('2026-11-16');
    expect(d).toMatchObject({ n: 4, ok: 3, st: 20, se: 85, sk: 40, ks: 90, kn: 1 });
    expect(d.m).toBeUndefined();
    // Lên hộp 4: tính 1 mục mới thuộc, chỉ một lần.
    for (let i = 0; i < 4; i++) p.grade('tr:K001', 2);
    expect(p.dayStat('2026-11-16').m).toBe(1);
    await p.flush();
    expect(await store.days.get('2026-11-16')).toEqual(p.dayStat('2026-11-16'));
  });
});

describe('ranh giới ngày và tuần theo giờ máy', () => {
  it('tuần bắt đầu thứ Hai', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16'); // thứ Hai
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Chủ nhật thuộc tuần trước đó
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
    expect(weekStart('2027-01-01')).toBe('2026-12-28'); // qua năm
    expect(weekDays('2026-11-30')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
    expect(weekLabel('2026-11-30')).toBe('30/11 – 06/12');
  });

  it('lượt chấm trước và sau nửa đêm vào hai ngày, hai tuần khác nhau', async () => {
    let now = new Date(2026, 10, 22, 23, 59, 30).getTime(); // Chủ nhật
    const p = new Progress(freshDb(), () => new Date(now));
    await p.load();
    p.touch();
    now += 20_000;
    p.grade('tr:K001', 2);
    now += 30_000; // 00:00:20 thứ Hai
    p.grade('tr:K002', 2);
    expect(p.dayStat('2026-11-22')).toMatchObject({ n: 1, st: 20 });
    expect(p.dayStat('2026-11-23')).toMatchObject({ n: 1, st: 30 });
    expect(weekSummary((d) => p.dayStat(d), '2026-11-16', 15).n).toBe(1);
    expect(weekSummary((d) => p.dayStat(d), '2026-11-23', 15).n).toBe(1);
  });
});

describe('chuỗi ngày có ngày nghỉ', () => {
  const of = (days: string[]) => (d: string) => (days.includes(d) ? 1 : 0);
  // 2026-11-16 là thứ Hai; 14 = thứ Bảy, 15 = Chủ nhật.
  it('ngày nghỉ không ôn thì không đứt, không cộng', () => {
    const days = ['2026-11-12', '2026-11-13', '2026-11-16'];
    expect(streakCount(of(days), '2026-11-16')).toBe(1);
    expect(streakCount(of(days), '2026-11-16', [6, 0])).toBe(3);
  });
  it('ngày nghỉ có ôn vẫn cộng; ngày thường bỏ thì đứt', () => {
    expect(streakCount(of(['2026-11-13', '2026-11-14', '2026-11-16']), '2026-11-16', [6, 0])).toBe(3);
    expect(streakCount(of(['2026-11-12', '2026-11-16']), '2026-11-16', [6, 0])).toBe(1);
  });
  it('hôm nay và hôm qua đều là ngày nghỉ chưa ôn: giữ chuỗi', () => {
    expect(streakCount(of(['2026-11-12', '2026-11-13']), '2026-11-15', [6, 0])).toBe(2);
  });
  it('chọn cả 7 ngày thì coi như không có ngày nghỉ (không lặp vô hạn)', () => {
    expect(streakCount(of(['2026-11-16']), '2026-11-16', [0, 1, 2, 3, 4, 5, 6])).toBe(1);
    expect(normalizePrefs({ restDays: [0, 1, 2, 3, 4, 5, 6] }).restDays).toHaveLength(6);
    expect(normalizePrefs({})).toMatchObject({ goalMin: 15, restDays: [] });
    expect(normalizePrefs({ goalMin: 7, restDays: [6, 0, 9] })).toMatchObject({ goalMin: 15, restDays: [6, 0] });
    expect(normalizePrefs({ goalMin: 30 }).goalMin).toBe(30);
  });
});

describe('tổng kết tuần', () => {
  const data: DayStat[] = [
    // tuần trước (09–15/11)
    day({ day: '2026-11-10', n: 10, ok: 5, s: 600 }), // ngày cũ, chưa tách
    day({ day: '2026-11-12', n: 10, ok: 7, s: 0, st: 300, se: 300, sk: 400, ks: 120, kn: 2, m: 1 }),
    // tuần này (16–22/11)
    day({ day: '2026-11-16', n: 20, ok: 18, s: 0, st: 400, se: 500, sk: 100, ks: 160, kn: 2, m: 3 }),
    day({ day: '2026-11-17', n: 5, ok: 2, s: 0, st: 120, m: 1 }),
    day({ day: '2026-11-18', n: 0, ok: 0, s: 0 }),
  ];
  const get = (d: string) => data.find((x) => x.day === d) ?? day({ day: d });

  it('cộng số liệu trong tuần', () => {
    const w = weekSummary(get, '2026-11-16', 15);
    expect(w).toMatchObject({ secs: 1120, tr: 520, en: 500, speak: 100, activeDays: 2, goalDays: 1, mastered: 4, n: 25, ok: 20, recall: 0.8, speakAvg: 80, empty: false });
    expect(w.days.map((d) => d.met)).toEqual([true, false, false, false, false, false, false]);
    expect(mins(w.secs)).toBe(19);
  });

  it('so với tuần trước', () => {
    const w = weekSummary(get, '2026-11-16', 15);
    const pv = weekSummary(get, '2026-11-09', 15);
    expect(pv).toMatchObject({ secs: 1600, tr: 300, goalDays: 1, mastered: 1, recall: 0.6, speakAvg: 60 });
    expect(delta(mins(w.secs), mins(pv.secs))).toEqual({ dir: 'down', by: 8 });
    expect(delta(w.mastered, pv.mastered)).toEqual({ dir: 'up', by: 3 });
    expect(delta(w.goalDays, pv.goalDays)).toEqual({ dir: 'same', by: 0 });
    expect(delta(w.speakAvg, pv.speakAvg)).toEqual({ dir: 'up', by: 20 });
    expect(delta(w.speakAvg, null)).toBeNull();
  });

  it('tuần rỗng', () => {
    const w = weekSummary(get, '2026-11-23', 15);
    expect(w).toMatchObject({ empty: true, secs: 0, recall: null, speakAvg: null, goalDays: 0 });
    expect(mins(0)).toBe(0);
    expect(mins(20)).toBe(1);
  });
});

describe('sao lưu giữ trường mới', () => {
  const full: DayStat = { day: '2026-11-16', n: 20, ok: 18, s: 900, nw: 3, st: 400, se: 500, sk: 100, ks: 160, kn: 2, m: 3 };

  it('xuất rồi nhập lại (thay thế) giữ nguyên', async () => {
    const a = freshDb();
    await a.days.put(full);
    const file = parseBackup(JSON.stringify(await exportBackup(a)));
    const b = freshDb();
    await applyBackup(file, 'replace', b);
    expect(await b.days.get('2026-11-16')).toEqual(full);
  });

  it('gộp: lấy số lớn hơn từng trường, điểm nói theo bên có nhiều lần chấm hơn', async () => {
    const a = freshDb();
    await a.days.put(full);
    const file = parseBackup(JSON.stringify(await exportBackup(a)));
    const b = freshDb();
    await b.days.put({ day: '2026-11-16', n: 25, ok: 10, s: 100, st: 600, ks: 50, kn: 1 });
    await applyBackup(file, 'merge', b);
    expect(await b.days.get('2026-11-16')).toEqual({ day: '2026-11-16', n: 25, ok: 18, s: 900, nw: 3, st: 600, se: 500, sk: 100, ks: 160, kn: 2, m: 3 });
  });

  it('file cũ không có trường mới vẫn nhập được', async () => {
    const a = freshDb();
    await a.days.put(full);
    const raw = JSON.parse(JSON.stringify(await exportBackup(a))) as { days: Record<string, unknown>[] };
    raw.days = raw.days.map(({ day: d, n, ok, s }) => ({ day: d, n, ok, s }));
    const b = freshDb();
    await applyBackup(parseBackup(JSON.stringify(raw)), 'replace', b);
    const got = await b.days.get('2026-11-16');
    expect(got).toEqual({ day: '2026-11-16', n: 20, ok: 18, s: 900 });
    expect(studySecs(got!)).toBe(900);
  });
});
