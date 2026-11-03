import { describe, expect, it } from 'vitest';
import { applyGrade } from '../../src/core/leitner';
import { FALLBACK_TOPICS, SPEAKING_TOPICS, USING_FALLBACK_TOPICS, defaultSeconds, loadTopics } from '../../src/modules/english/speech/topics';
import { SAY_ITEMS, buildSayItems, planSpeaking, sayId } from '../../src/modules/english/speech/sayItems';
import { scoreSpeech } from '../../src/modules/english/speech/score';

describe('đề nói', () => {
  it('có file speaking-topics.json thì dùng file, không thì đề tạm', () => {
    expect(loadTopics({})).toEqual(FALLBACK_TOPICS);
    expect(loadTopics({ a: { items: [FALLBACK_TOPICS[0]!] } })).toHaveLength(1);
    // main đã có content/english/speaking-topics.json (S7) → phải nạp được file, không dùng đề tạm.
    expect(SPEAKING_TOPICS.length).toBeGreaterThanOrEqual(100);
    expect(USING_FALLBACK_TOPICS).toBe(false);
    for (const t of SPEAKING_TOPICS) expect(t.hints.length).toBeGreaterThanOrEqual(2);
  });
  it('thời gian mặc định 30/60/90', () => {
    expect(defaultSeconds({})).toBe(60);
    expect(defaultSeconds({ seconds: 30 })).toBe(30);
    expect(defaultSeconds({ seconds: 120 })).toBe(90);
  });
});

describe('câu luyện nói', () => {
  it('gồm câu mẫu, ví dụ cụm từ, câu hội thoại; id riêng en:say:', () => {
    expect(SAY_ITEMS.some((i) => i.src === 'pattern')).toBe(true);
    expect(SAY_ITEMS.some((i) => i.src === 'example')).toBe(true);
    expect(SAY_ITEMS.some((i) => i.src === 'dialogue')).toBe(true);
    expect(new Set(SAY_ITEMS.map((i) => i.id)).size).toBe(SAY_ITEMS.length);
    expect(SAY_ITEMS.every((i) => i.id.startsWith('en:say:'))).toBe(true);
    const d = buildSayItems([{ id: 'dl-x', title: 'T', situation: 's', topic: 'office', level: 'B1', lines: [{ speaker: 'A', en: 'Hi.', vi: 'Chào' }, { speaker: 'B', en: 'Could we move the meeting?', vi: '…' }] }]);
    const dl = d.filter((i) => i.src === 'dialogue');
    expect(dl.map((i) => i.id)).toEqual([sayId('dl-x:2')]);
  });

  it('mọi câu đích tự chấm chính nó được 100%', () => {
    for (const it of SAY_ITEMS) expect(scoreSpeech(it.en, it.en).score, it.en).toBe(100);
  });

  it('lập lượt: đúng số câu, câu đã nói tốt chưa đến hạn bị bỏ, lọc theo nguồn', () => {
    const items = SAY_ITEMS.slice(0, 30);
    const states = new Map(items.slice(0, 25).map((i) => [i.id, applyGrade(undefined, 2, '2026-11-03')]));
    const list = planSpeaking((id) => states.get(id), '2026-11-03', { count: 10, items });
    expect(list).toHaveLength(5);
    expect(list.every((i) => !states.has(i.id))).toBe(true);
    const ex = planSpeaking(() => undefined, '2026-11-03', { count: 5, sources: ['example'] });
    expect(ex).toHaveLength(5);
    expect(ex.every((i) => i.src === 'example')).toBe(true);
  });
});
