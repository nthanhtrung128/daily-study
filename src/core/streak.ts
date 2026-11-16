import { addDays } from './date';

/**
 * Chuỗi ngày: số ngày liên tiếp có ít nhất 1 lượt ôn, tính lùi từ hôm nay.
 * Hôm nay chưa ôn thì chuỗi vẫn giữ nếu hôm qua có ôn (như bản cũ).
 * Ngày nghỉ đã chọn (`restDays`, 0 = CN) mà không ôn thì bỏ qua: không cộng, không làm đứt chuỗi;
 * ngày nghỉ có ôn vẫn được cộng.
 */
export function streakCount(countOf: (day: string) => number, today: string, restDays: readonly number[] = []): number {
  const rest = (k: string) => restDays.length < 7 && restDays.includes(new Date(`${k}T00:00:00`).getDay());
  let k = countOf(today) > 0 ? today : addDays(today, -1);
  let n = 0;
  for (;;) {
    if (countOf(k) > 0) n++;
    else if (!rest(k)) break;
    k = addDays(k, -1);
  }
  return n;
}
