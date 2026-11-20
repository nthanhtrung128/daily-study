import { expect, it } from 'vitest';
import { entryById } from '../../src/modules/lookup';
import { ITEM_BY_ID } from '../../src/modules/tr/items';
import { ROADMAP_MODULES } from '../../src/modules/tr/roadmap';
import { relatedCardIds } from '../../src/modules/tr/roadmapCards';

it('mỗi bài có thẻ riêng, mở được trong bài đọc và dùng được trong phiên ôn', () => {
  for (const module of ROADMAP_MODULES) {
    for (const lesson of module.lessons) {
      const ids = relatedCardIds(lesson.id);
      expect(ids.length, lesson.id).toBeGreaterThan(0);
      expect(new Set(ids).size, lesson.id).toBe(ids.length);
      for (const id of ids) {
        expect(entryById(id)?.title, lesson.id + ' / ' + id).toBeTruthy();
        expect(ITEM_BY_ID.has(id), lesson.id + ' / ' + id).toBe(true);
      }
    }
  }
  expect(relatedCardIds('khong-co-bai')).toEqual([]);
});
