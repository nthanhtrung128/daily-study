import { describe, expect, it } from 'vitest';
import { ICS_UID, appUrl, buildIcs, escapeText, firstDay, foldLine, utcStamp, weekdayOf } from '../../src/core/ics';

const NOW = new Date(Date.UTC(2026, 10, 3, 10, 15, 7));
const base = { time: '20:30', days: [1, 3, 5], from: '2026-11-03', now: NOW };

/** Bỏ gập dòng (RFC 5545 §3.1). */
const unfold = (s: string) => s.replace(/\r\n[ \t]/g, '');
const prop = (ics: string, name: string) =>
  unfold(ics)
    .split('\r\n')
    .filter((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`));

describe('file nhắc lịch .ics', () => {
  it('khung VCALENDAR / VTIMEZONE / VEVENT / VALARM đúng thứ tự, mọi dòng kết thúc CRLF', () => {
    const ics = buildIcs(base);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    const lines = unfold(ics).split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
    const order = ['BEGIN:VTIMEZONE', 'END:VTIMEZONE', 'BEGIN:VEVENT', 'BEGIN:VALARM', 'END:VALARM', 'END:VEVENT'].map((x) => lines.indexOf(x));
    expect(order.every((v, i) => v > 0 && (i === 0 || v > (order[i - 1] ?? 0)))).toBe(true);
    expect(lines).toContain('VERSION:2.0');
    expect(lines.some((l) => l.startsWith('PRODID:'))).toBe(true);
    // Các BEGIN/END cân bằng.
    const begins = lines.filter((l) => l.startsWith('BEGIN:')).map((l) => l.slice(6));
    const ends = lines.filter((l) => l.startsWith('END:')).map((l) => l.slice(4));
    expect([...begins].sort()).toEqual([...ends].sort());
  });

  it('múi giờ Asia/Bangkok, buổi đầu là ngày gần nhất khớp thứ, lặp RRULE hằng tuần', () => {
    const ics = buildIcs(base);
    expect(prop(ics, 'TZID')).toEqual(['TZID:Asia/Bangkok']);
    expect(ics).toContain('TZOFFSETTO:+0700');
    // 03/11/2026 là thứ Ba → buổi đầu thứ Tư 04/11.
    expect(prop(ics, 'DTSTART')).toContain('DTSTART;TZID=Asia/Bangkok:20261104T203000');
    expect(prop(ics, 'RRULE')).toEqual(['RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=MO,WE,FR']);
    expect(prop(ics, 'DURATION')).toEqual(['DURATION:PT15M']);
    expect(prop(ics, 'DTSTAMP')).toEqual(['DTSTAMP:20261103T101507Z']);
  });

  it('UID ổn định giữa các lần tạo; có VALARM hiển thị đúng giờ hoặc báo trước', () => {
    const a = buildIcs(base);
    const b = buildIcs({ ...base, time: '06:00', days: [0], now: new Date() });
    expect(prop(a, 'UID')).toEqual([`UID:${ICS_UID}`]);
    expect(prop(b, 'UID')).toEqual([`UID:${ICS_UID}`]);
    expect(a).toContain('ACTION:DISPLAY');
    expect(prop(a, 'TRIGGER')).toEqual(['TRIGGER:PT0S']);
    expect(prop(buildIcs({ ...base, alarmBefore: 10 }), 'TRIGGER')).toEqual(['TRIGGER:-PT10M']);
  });

  it('URL chỉ có khi biết origin; DESCRIPTION có link và được thoát ký tự', () => {
    expect(prop(buildIcs(base), 'URL')).toEqual([]);
    const ics = buildIcs({ ...base, url: 'https://on.example.vn/app/#hom-nay', minutes: 20 });
    expect(prop(ics, 'URL')).toEqual(['URL:https://on.example.vn/app/#hom-nay']);
    const desc = prop(ics, 'DESCRIPTION')[0] ?? '';
    expect(desc).toContain('(20 phút).\\nhttps://on.example.vn/app/#hom-nay');
    expect(prop(ics, 'DURATION')).toEqual(['DURATION:PT20M']);
  });

  it('gập dòng ≤ 75 octet, không cắt giữa ký tự UTF-8 nhiều byte; bỏ gập ra đúng nội dung', () => {
    const long = 'Ôn luyện mỗi ngày: Total Rewards, tiếng Anh công sở; nói lưu loát — '.repeat(4);
    const ics = buildIcs({ ...base, summary: long, description: long });
    for (const l of ics.split('\r\n')) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
    expect(prop(ics, 'SUMMARY')).toEqual([`SUMMARY:${escapeText(long)}`]);
    expect(ics).not.toContain('�');
    const folded = foldLine(`X:${'ữ'.repeat(60)}`);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(' ')).toBe(true);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`X:${'ữ'.repeat(60)}`);
    expect(foldLine('SHORT:ok')).toBe('SHORT:ok');
  });

  it('thoát ký tự TEXT', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('báo lỗi khi không chọn ngày hoặc giờ sai', () => {
    expect(() => buildIcs({ ...base, days: [] })).toThrow();
    expect(() => buildIcs({ ...base, time: '8h' })).toThrow();
  });

  it('tiện ích ngày', () => {
    expect(weekdayOf('2026-11-03')).toBe(2);
    expect(firstDay('2026-11-03', [2])).toBe('2026-11-03');
    expect(firstDay('2026-11-03', [1])).toBe('2026-11-09');
    expect(utcStamp(NOW)).toBe('20261103T101507Z');
    expect(buildIcs({ ...base, days: [0, 1, 2, 3, 4, 5, 6] })).toContain('BYDAY=SU,MO,TU,WE,TH,FR,SA');
  });

  it('appUrl: https có origin → link #hom-nay; file:// hay localhost → không', () => {
    expect(appUrl({ protocol: 'https:', host: 'on.example.vn', hostname: 'on.example.vn', pathname: '/app/' })).toBe('https://on.example.vn/app/#hom-nay');
    expect(appUrl({ protocol: 'file:', host: '', hostname: '', pathname: '/x/index.html' })).toBeUndefined();
    expect(appUrl({ protocol: 'http:', host: 'localhost:4173', hostname: 'localhost', pathname: '/' })).toBeUndefined();
  });
});
