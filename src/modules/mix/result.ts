import type { Grade } from '../../core/leitner';
import type { Lane } from '../../core/mix';
import { titleOfEn } from '../english/content';
import { titleOf } from '../tr/items';
import type { DailyEntry } from './plan';

/** Kết quả một mục trong phiên hằng ngày. g = null: bài nói không chấm (đề nói 1 phút) hoặc bỏ qua. */
export interface DailyResult {
  entry: DailyEntry;
  g: Grade | null;
  /** Điểm nói (%), nếu có. */
  score?: number | null;
}

export interface LaneTally {
  n: number;
  ok: number;
  vague: number;
  wrong: number;
}

export interface Tally {
  tr: LaneTally;
  en: LaneTally;
  /** Bài nói: đã làm (kể cả đề nói không chấm), điểm câu nói nếu có. */
  speak: { done: number; score: number | null };
  /** Nghe chép trong phiên: số câu đã chép và điểm trung bình (%). Các câu này cũng tính vào hàng Tiếng Anh. */
  dict: { done: number; score: number | null };
  /** Mục chấm Quên/Sai hoặc Mơ hồ — cần ôn lại. */
  review: DailyResult[];
}

const zero = (): LaneTally => ({ n: 0, ok: 0, vague: 0, wrong: 0 });

export function tally(results: readonly DailyResult[]): Tally {
  const t: Tally = { tr: zero(), en: zero(), speak: { done: 0, score: null }, dict: { done: 0, score: null }, review: [] };
  let dictSum = 0;
  for (const r of results) {
    if (r.entry.tier === 'extra' && r.entry.item.kind === 'dict') {
      if (typeof r.score === 'number') {
        t.dict.done++;
        dictSum += r.score;
      }
    } else if (r.entry.tier === 'extra') {
      t.speak.done++;
      if (typeof r.score === 'number') t.speak.score = r.score;
    }
    if (r.g === null) continue;
    const lane: Lane = r.entry.lane;
    const l = t[lane];
    l.n++;
    if (r.g === 2) l.ok++;
    else if (r.g === 1) l.vague++;
    else l.wrong++;
    if (r.g < 2) t.review.push(r);
  }
  if (t.dict.done) t.dict.score = Math.round(dictSum / t.dict.done);
  // Quên/sai lên trước mơ hồ.
  t.review.sort((a, b) => (a.g ?? 0) - (b.g ?? 0));
  return t;
}

export function titleOfEntry(e: DailyEntry): string {
  if (e.tier === 'extra') return e.item.kind === 'topic' ? e.item.topic.en : e.item.item.en;
  return e.lane === 'tr' ? titleOf(e.item) : titleOfEn(e.item);
}

export const LANE_VI: Record<Lane, string> = { tr: 'Total Rewards', en: 'Tiếng Anh' };
