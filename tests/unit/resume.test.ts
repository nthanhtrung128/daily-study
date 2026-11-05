import { afterEach, describe, expect, it } from 'vitest';
import { StudyDB } from '../../src/core/db';
import { ACTIVE_KEY, RESUME_MAX_MS, advance, clearActive, loadActive, restoreSession, saveActive, type ActiveSession } from '../../src/core/resume';
import { shouldShowUpdate } from '../../src/ui/swUpdate';

const NOW = 1_800_000_000_000;
const base = (o: Partial<ActiveSession> = {}): ActiveSession => ({
  kind: 'mix',
  items: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })),
  pos: 3,
  results: [
    { i: 0, g: 2 },
    { i: 1, g: 0 },
    { i: 2, g: null },
  ],
  t0: NOW - 10 * 60_000,
  minutes: 10,
  savedAt: NOW - 5 * 60_000,
  ...o,
});
const content = new Map(['a', 'b', 'c', 'd', 'e'].map((id) => [id, { id }]));

describe('tiếp tục phiên dở', () => {
  it('khôi phục đúng câu tiếp theo, kết quả đã có, thời gian đã ôn', () => {
    const r = restoreSession(base(), (it) => content.get(it.id), NOW);
    expect(r?.list.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(r?.pos).toBe(3);
    expect(r?.results.map((x) => [x.item.id, x.g])).toEqual([
      ['a', 2],
      ['b', 0],
      ['c', null],
    ]);
    // Đã ôn 5 phút trước khi gián đoạn: t0 mới = now − 5 phút (không tính lúc app tắt).
    expect(r?.t0).toBe(NOW - 5 * 60_000);
  });

  it('quá 12 giờ thì bỏ', () => {
    expect(restoreSession(base({ savedAt: NOW - RESUME_MAX_MS - 1 }), (it) => content.get(it.id), NOW)).toBeNull();
    expect(restoreSession(base({ savedAt: NOW - RESUME_MAX_MS + 1000 }), (it) => content.get(it.id), NOW)).not.toBeNull();
  });

  it('mục không còn trong nội dung thì bỏ qua (vị trí và kết quả dời theo)', () => {
    const look = (it: { id: string }) => (it.id === 'b' || it.id === 'd' ? undefined : content.get(it.id));
    const r = restoreSession(base(), look, NOW);
    expect(r?.list.map((x) => x.id)).toEqual(['a', 'c', 'e']);
    expect(r?.pos).toBe(2);
    expect(r?.list[r.pos]?.id).toBe('e');
    expect(r?.results.map((x) => x.item.id)).toEqual(['a', 'c']);
    // Không còn mục nào để làm.
    expect(restoreSession(base(), (it) => (it.id === 'a' ? content.get(it.id) : undefined), NOW)).toBeNull();
  });

  it('advance: dời vị trí, không thêm trùng kết quả', () => {
    const s = advance(base(), 4, NOW, { i: 3, g: 1 });
    expect(s.pos).toBe(4);
    expect(s.results).toHaveLength(4);
    expect(advance(s, 4, NOW, { i: 3, g: 2 }).results).toHaveLength(4);
    expect(s.savedAt).toBe(NOW);
  });

  describe('lưu trong Dexie', () => {
    const store = new StudyDB('test-resume');
    afterEach(async () => {
      await store.delete();
      await store.open();
    });

    it('lưu, đọc lại; kết thúc thì xóa khóa; quá hạn thì tự xóa', async () => {
      await saveActive(base(), store);
      expect((await loadActive(NOW, store))?.pos).toBe(3);
      await clearActive(store);
      expect(await loadActive(NOW, store)).toBeNull();
      expect(await store.settings.get(ACTIVE_KEY)).toBeUndefined();

      await saveActive(base({ savedAt: NOW - RESUME_MAX_MS - 1 }), store);
      expect(await loadActive(NOW, store)).toBeNull();
      expect(await store.settings.get(ACTIVE_KEY)).toBeUndefined();
    });
  });
});

describe('dải cập nhật bản mới', () => {
  it('chỉ hiện khi có bản mới, chưa bấm Để sau, và không đang trong phiên ôn', () => {
    expect(shouldShowUpdate(true, false, false)).toBe(true);
    expect(shouldShowUpdate(true, false, true)).toBe(false);
    expect(shouldShowUpdate(true, true, false)).toBe(false);
    expect(shouldShowUpdate(false, false, false)).toBe(false);
  });
});
