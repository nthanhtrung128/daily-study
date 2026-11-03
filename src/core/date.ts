/**
 * Ngày dạng YYYY-MM-DD theo giờ máy (người dùng ở Asia/Bangkok, UTC+7).
 * Dùng giờ địa phương của thiết bị như bản cũ, không ép múi giờ.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Cộng n ngày vào khóa ngày (tính theo lịch, không theo 24h để an toàn khi đổi giờ). */
export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Số ngày từ b đến a (a − b). */
export function dayDiff(a: string, b: string): number {
  return Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 864e5);
}
