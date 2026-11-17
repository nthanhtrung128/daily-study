import { getSetting, setSetting } from '../../core/db';
import type { Grade } from '../../core/leitner';
import type { RecErrorCode } from './speech/recognizer';
import { SAY_ITEMS, sayId } from './speech/sayItems';
import { gradeForScore } from './speech/score';
import { DIALOGUES, type Dialogue } from './tracks';

/**
 * Hội thoại nhập vai: người học đóng một vai, app đọc lượt của các vai còn lại (TTS),
 * đến lượt mình thì nói → nhận giọng → chấm từng từ (`speech/score.ts`).
 * File này chỉ chứa logic thuần (lập lượt, mức gợi ý, tổng kết, lưu kết quả); giao diện ở `ui/RoleplayScreen.tsx`.
 */
export interface Role {
  speaker: string;
  name: string;
}
export type RpDialogue = Dialogue & { roles: Role[] };

/** 60 hội thoại trong content/english/dialogues.json (schema bắt buộc có `roles`). */
export const RP_DIALOGUES = DIALOGUES as unknown as readonly RpDialogue[];
export const RP_LEVELS: readonly string[] = [...new Set(RP_DIALOGUES.map((d) => d.level))].sort();

export const PREFERRED_ROLE = 'Chuyên viên C&B';

/** Vai mặc định: "Chuyên viên C&B" nếu có, không thì vai có "(bạn)" / "C&B" trong tên, cuối cùng là vai đầu tiên. */
export function defaultRole(d: Pick<RpDialogue, 'roles'>): string {
  const by = (test: (name: string) => boolean) => d.roles.find((r) => test(r.name))?.speaker;
  return by((n) => n === PREFERRED_ROLE) ?? by((n) => n.includes('(bạn)')) ?? by((n) => n.includes('C&B')) ?? d.roles[0]?.speaker ?? 'A';
}

export interface Turn {
  /** Vị trí câu trong hội thoại (0-based). */
  i: number;
  speaker: string;
  name: string;
  en: string;
  vi: string;
  /** Lượt của người học. */
  mine: boolean;
  /** Id Leitner "en:say:…" nếu câu này cũng là câu luyện nói (≥ 4 từ); câu ngắn hơn thì không có. */
  sayId?: string;
}

const SAY_IDS = new Set(SAY_ITEMS.map((s) => s.id));

/** Lập các lượt theo vai đã chọn (giữ nguyên thứ tự hội thoại). */
export function buildTurns(d: RpDialogue, role: string): Turn[] {
  const names = new Map(d.roles.map((r) => [r.speaker, r.name]));
  return d.lines.map((l, i): Turn => {
    const id = sayId(`${d.id}:${i + 1}`);
    return { i, speaker: l.speaker, name: names.get(l.speaker) ?? l.speaker, en: l.en, vi: l.vi, mine: l.speaker === role, ...(SAY_IDS.has(id) ? { sayId: id } : {}) };
  });
}

/** Mức hỗ trợ ở lượt của người học. */
export type HintLevel = 'full' | 'vi' | 'none';
export const HINT_LEVELS: readonly { id: HintLevel; label: string }[] = [
  { id: 'full', label: 'Hiện câu' },
  { id: 'vi', label: 'Chỉ nghĩa' },
  { id: 'none', label: 'Ẩn hết' },
];

/** Phần được hiện ở lượt của người học; sau khi đã chấm thì luôn hiện đủ để so sánh. */
export function hintFor(level: HintLevel, answered = false): { en: boolean; vi: boolean } {
  if (answered || level === 'full') return { en: true, vi: true };
  return { en: false, vi: level === 'vi' };
}

/** Lỗi nhận giọng khiến phải chuyển sang tự đánh giá (lỗi khác, vd "không nghe thấy", chỉ cần nói lại). */
const FALLBACK = new Set<RecErrorCode>(['unsupported', 'denied', 'service', 'network', 'audio-capture', 'language']);
export const needsSelfGrade = (err: RecErrorCode | null): boolean => err !== null && FALLBACK.has(err);

export interface TurnResult {
  turn: Turn;
  /** Điểm cao nhất các lần nói (null = tự đánh giá). */
  score: number | null;
  g: Grade;
}

/** Kết quả một lượt: có điểm máy chấm thì quy ra mức, không thì dùng mức tự đánh giá. */
export function turnResult(turn: Turn, best: number | null, self: Grade | null): TurnResult | null {
  if (best !== null) return { turn, score: best, g: gradeForScore(best) };
  return self === null ? null : { turn, score: null, g: self };
}

export interface RpSummary {
  /** Số lượt đã nói. */
  n: number;
  /** Điểm trung bình các lượt máy chấm (làm tròn); null nếu cả phiên tự đánh giá. */
  avg: number | null;
  /** Các câu chưa đạt "Nhớ rõ" (< 90% hoặc tự chấm Quên / Mơ hồ), thấp nhất trước. */
  weak: TurnResult[];
}

export function summarize(results: readonly TurnResult[]): RpSummary {
  const scores = results.flatMap((r) => (r.score === null ? [] : [r.score]));
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const weak = results.filter((r) => r.g < 2).sort((a, b) => (a.score ?? a.g * 45) - (b.score ?? b.g * 45));
  return { n: results.length, avg, weak };
}

/** Kết quả lần luyện gần nhất của một hội thoại. */
export interface RpRecord {
  /** Ngày luyện (YYYY-MM-DD, giờ máy). */
  day: string;
  at: number;
  /** Điểm trung bình (null = tự đánh giá cả bài). */
  score: number | null;
  /** Vai đã đóng (speaker). */
  role: string;
  /** Số lượt đã nói / tổng số lượt của vai. */
  n: number;
  total: number;
}
export type RpStore = Record<string, RpRecord>;

/** Lưu trong bảng `settings` (khóa mới, không đổi cấu trúc Dexie). */
export const RP_KEY = 'en.roleplay';
export const RP_HINT_KEY = 'en.roleplay.hint';

export const loadRpStore = (): Promise<RpStore> => getSetting<RpStore>(RP_KEY, {}).catch(() => ({}));

export async function saveRpRecord(dialogueId: string, rec: RpRecord): Promise<RpStore> {
  const next = { ...(await loadRpStore()), [dialogueId]: rec };
  await setSetting(RP_KEY, next);
  return next;
}

export const loadHint = (): Promise<HintLevel> =>
  getSetting<HintLevel>(RP_HINT_KEY, 'full')
    .then((v) => (HINT_LEVELS.some((h) => h.id === v) ? v : 'full'))
    .catch(() => 'full');
export const saveHint = (h: HintLevel): Promise<void> => setSetting(RP_HINT_KEY, h).catch(() => undefined);

/** Luyện lại riêng các câu điểm thấp: giữ lượt của mình theo `lineIdx`, kèm câu ngay trước (của vai kia) làm ngữ cảnh. */
export function weakTurns(turns: readonly Turn[], lineIdx: readonly number[]): Turn[] {
  const want = new Set(lineIdx);
  return turns.filter((t, k) => (t.mine ? want.has(t.i) : !!turns[k + 1]?.mine && want.has(turns[k + 1]!.i)));
}
