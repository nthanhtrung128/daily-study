import { addDays } from './date';

/**
 * Chuỗi ngày: số ngày liên tiếp có ít nhất 1 lượt ôn, tính lùi từ hôm nay.
 * Hôm nay chưa ôn thì chuỗi vẫn giữ nếu hôm qua có ôn (như bản cũ).
 */
export function streakCount(countOf: (day: string) => number, today: string): number {
  let k = countOf(today) > 0 ? today : addDays(today, -1);
  let n = 0;
  while (countOf(k) > 0) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}
