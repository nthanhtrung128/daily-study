/**
 * Sinh file nhắc lịch .ics (RFC 5545) để thêm vào Lịch iPhone — hàm thuần, không gọi mạng.
 * - VCALENDAR + VTIMEZONE Asia/Bangkok (UTC+7, không đổi giờ mùa hè) + một VEVENT lặp hằng tuần (RRULE BYDAY) có VALARM.
 * - UID cố định: nhập lại file sau khi đổi giờ thì ứng dụng Lịch coi là cùng một sự kiện (nếu nó hỗ trợ cập nhật theo UID).
 * - Xuống dòng CRLF; dòng dài hơn 75 octet (UTF-8) được gập bằng CRLF + dấu cách, không cắt giữa ký tự nhiều byte.
 * - Văn bản được thoát \\ ; , và xuống dòng theo mục 3.3.11.
 */
import { addDays } from './date';

export const ICS_TZID = 'Asia/Bangkok';
export const ICS_UID = 'nhac-on-luyen-moi-ngay@daily-study.app';
export const ICS_FILENAME = 'nhac-on-luyen.ics';
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

export interface ReminderOptions {
  /** Giờ nhắc "HH:MM" theo giờ Asia/Bangkok. */
  time: string;
  /** Các ngày trong tuần (0 = CN … 6 = T7). Rỗng → lỗi. */
  days: readonly number[];
  /** Ngày bắt đầu tìm buổi đầu tiên, YYYY-MM-DD (thường là hôm nay). */
  from: string;
  /** Thời điểm tạo file (DTSTAMP, UTC). */
  now: Date;
  /** Thời lượng sự kiện (phút). */
  minutes?: number;
  /** Báo trước bao nhiêu phút (0 = đúng giờ). */
  alarmBefore?: number;
  /** Link mở app (chỉ thêm khi biết origin). */
  url?: string;
  summary?: string;
  description?: string;
}

/** Thoát văn bản TEXT (RFC 5545 §3.3.11). */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

const utf8Len = (ch: string): number => {
  const c = ch.codePointAt(0) ?? 0;
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
};

/** Gập một dòng nội dung: mỗi dòng vật lý ≤ 75 octet (kể cả dấu cách mở đầu dòng tiếp). */
export function foldLine(line: string, limit = 75): string {
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = utf8Len(ch);
    const max = parts.length ? limit - 1 : limit; // dòng tiếp có 1 octet dấu cách
    if (bytes + n > max) {
      parts.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** DTSTAMP dạng UTC: 20261103T101500Z. */
export function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Thứ trong tuần của khóa ngày YYYY-MM-DD (0 = CN), tính theo lịch, không phụ thuộc múi giờ máy. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Ngày đầu tiên ≥ from rơi vào một trong các thứ đã chọn. */
export function firstDay(from: string, days: readonly number[]): string {
  let k = from;
  for (let i = 0; i < 7; i++) {
    if (days.includes(weekdayOf(k))) return k;
    k = addDays(k, 1);
  }
  return from;
}

export function buildIcs(o: ReminderOptions): string {
  const days = [...new Set(o.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (!days.length) throw new Error('Chọn ít nhất một ngày trong tuần.');
  const m = /^(\d{2}):(\d{2})$/.exec(o.time);
  if (!m) throw new Error('Giờ nhắc không hợp lệ.');
  const start = firstDay(o.from, days).replace(/-/g, '');
  const minutes = Math.max(5, Math.round(o.minutes ?? 15));
  const before = Math.max(0, Math.round(o.alarmBefore ?? 0));
  const summary = o.summary ?? 'Ôn luyện mỗi ngày: TR + tiếng Anh';
  const description =
    o.description ??
    `Mở app Ôn luyện mỗi ngày và bấm “Bắt đầu ôn hôm nay” (${minutes} phút).${o.url ? `\n${o.url}` : ''}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//daily-study//Nhac on luyen//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${ICS_TZID}`,
    `X-LIC-LOCATION:${ICS_TZID}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0700',
    'TZOFFSETTO:+0700',
    'TZNAME:+07',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${ICS_UID}`,
    `DTSTAMP:${utcStamp(o.now)}`,
    `DTSTART;TZID=${ICS_TZID}:${start}T${m[1]}${m[2]}00`,
    `DURATION:PT${minutes}M`,
    `RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=${days.map((d) => BYDAY[d]).join(',')}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(o.url ? [`URL:${o.url}`] : []),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    `TRIGGER:${before ? `-PT${before}M` : 'PT0S'}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map((l) => foldLine(l)).join('\r\n') + '\r\n';
}

/** Link mở app từ sự kiện lịch: chỉ khi app chạy qua http(s) (không phải file:// hay localhost lúc phát triển). */
export function appUrl(loc: Pick<Location, 'protocol' | 'host' | 'pathname' | 'hostname'>): string | undefined {
  if (!/^https?:$/.test(loc.protocol)) return undefined;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return undefined;
  return `${loc.protocol}//${loc.host}${loc.pathname}#hom-nay`;
}
