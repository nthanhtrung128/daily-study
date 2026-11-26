import { db, type StudyDB } from './db';

export const conversationPrefix = 'en.readingConversation.';
export type ConversationProgress = { at: number; scores: boolean[]; retryIndex?: number };
export type ConversationAction = boolean | 'restart' | 'retry';
export const freshConversation: ConversationProgress = { at: 0, scores: [] };
const turnCount = 3;

// Mỗi tình huống trong kho bài đọc có ba lượt tự chấm.
export function readConversation(value: unknown): ConversationProgress | undefined {
  if (!value || typeof value !== 'object') return;
  const { at, scores, retryIndex } = value as Partial<ConversationProgress>;
  if (typeof at !== 'number' || !Number.isSafeInteger(at) || at <= 0 || !Array.isArray(scores) ||
    scores.length > turnCount || !scores.every(score => typeof score === 'boolean')) return;
  if (scores.length === turnCount && typeof retryIndex === 'number' && Number.isInteger(retryIndex) && scores[retryIndex] === false) {
    return { at, scores, retryIndex };
  }
  return { at, scores };
}

export function advanceConversation(previous: ConversationProgress, action: ConversationAction): ConversationProgress | undefined {
  const at = Math.max(Date.now(), previous.at + 1);
  if (action === 'restart') return { at, scores: [] };
  const { scores, retryIndex } = previous;
  if (action === 'retry') {
    const first = scores.indexOf(false);
    if (scores.length === turnCount && retryIndex === undefined && first >= 0) return { at, scores, retryIndex: first };
    return;
  }
  if (retryIndex !== undefined) {
    const updated = scores.slice();
    updated[retryIndex] = action;
    // Mỗi câu xuất hiện một lần trong vòng này, kể cả khi người học vẫn cần luyện thêm.
    const next = updated.indexOf(false, retryIndex + 1);
    return next === -1 ? { at, scores: updated } : { at, scores: updated, retryIndex: next };
  }
  if (scores.length < turnCount) return { at, scores: [...scores, action] };
}

/** Hai cửa sổ cùng chấm một lượt chỉ ghi được một lần. Luyện lại cũng có mốc mới để gộp sao lưu. */
export function saveConversation(id: string, expectedAt: number, mark: ConversationAction, store: StudyDB = db) {
  const key = conversationPrefix + id;
  return store.transaction('rw', store.settings, async () => {
    const previous = readConversation((await store.settings.get(key))?.value) ?? freshConversation;
    if (previous.at !== expectedAt) return false;
    const progress = advanceConversation(previous, mark);
    if (!progress) return false;
    await store.settings.put({ key, value: progress });
    return true;
  });
}
