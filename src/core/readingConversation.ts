import { db, type StudyDB } from './db';

export const conversationPrefix = 'en.readingConversation.';
export type ConversationProgress = { at: number; scores: boolean[] };
export const freshConversation: ConversationProgress = { at: 0, scores: [] };

// Mỗi tình huống trong kho bài đọc có ba lượt tự chấm.
export function readConversation(value: unknown): ConversationProgress | undefined {
  if (!value || typeof value !== 'object') return;
  const { at, scores } = value as Partial<ConversationProgress>;
  if (typeof at === 'number' && Number.isSafeInteger(at) && at > 0 && Array.isArray(scores) &&
    scores.length <= 3 && scores.every(score => typeof score === 'boolean')) return { at, scores };
}

/** Hai cửa sổ cùng chấm một lượt chỉ ghi được một lần. Luyện lại cũng có mốc mới để gộp sao lưu. */
export function saveConversation(id: string, expectedAt: number, mark: boolean | 'restart', store: StudyDB = db) {
  const key = conversationPrefix + id;
  return store.transaction('rw', store.settings, async () => {
    const previous = readConversation((await store.settings.get(key))?.value) ?? freshConversation;
    if (previous.at !== expectedAt) return false;
    const scores = mark === 'restart' ? [] : [...previous.scores, mark];
    if (scores.length > 3) return false;
    await store.settings.put({ key, value: { at: Math.max(Date.now(), previous.at + 1), scores } });
    return true;
  });
}
