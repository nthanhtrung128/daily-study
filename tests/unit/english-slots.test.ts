import { describe, expect, it } from 'vitest';
import { PATTERNS, type Slot } from '../../src/modules/english/content';
import { applySlots, segments, slotPositions } from '../../src/modules/english/slots';

const en = 'Could you help me check the overtime figures this afternoon?';
const slots: Slot[] = [
  { text: 'check the overtime figures', alts: ['proofread the policy draft', 'update the leave tracker'] },
  { text: 'this afternoon', alts: ['before lunch', 'tomorrow morning'] },
];

describe('thay slot trong câu mẫu', () => {
  it('giữ nguyên câu khi chưa chọn', () => {
    expect(applySlots(en, slots)).toBe(en);
    expect(applySlots(en, slots, [-1, -1])).toBe(en);
  });

  it('thay từng slot độc lập', () => {
    expect(applySlots(en, slots, [1, -1])).toBe('Could you help me update the leave tracker this afternoon?');
    expect(applySlots(en, slots, [0, 0])).toBe('Could you help me proofread the policy draft before lunch?');
  });

  it('chia đoạn đánh dấu slot và đoạn đã đổi', () => {
    const segs = segments(en, slots, [-1, 1]);
    expect(segs.map((s) => s.text).join('')).toBe('Could you help me check the overtime figures tomorrow morning?');
    expect(segs.filter((s) => s.slot !== undefined)).toEqual([
      { text: 'check the overtime figures', slot: 0, changed: false },
      { text: 'tomorrow morning', slot: 1, changed: true },
    ]);
  });

  it('slot ở đầu câu và slot khai báo không theo thứ tự xuất hiện', () => {
    const s: Slot[] = [
      { text: 'by Friday', alts: ['by noon', 'today'] },
      { text: 'I', alts: ['We', 'She'] },
    ];
    expect(applySlots('I will send it by Friday.', s, [1, 0])).toBe('We will send it today.');
  });

  it('dữ liệu S4: mọi slot của 150 câu mẫu tìm thấy trong câu và không chồng nhau', () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(150);
    for (const p of PATTERNS) {
      const pos = slotPositions(p.en, p.slots);
      expect(pos.every((x) => x >= 0), p.id).toBe(true);
      for (let k = 0; k < p.slots.length; k++) {
        const choice = p.slots.map((_, i) => (i === k ? 0 : -1));
        expect(applySlots(p.en, p.slots, choice), p.id).toContain(p.slots[k]?.alts[0]);
      }
    }
  });
});
