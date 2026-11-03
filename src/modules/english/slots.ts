import type { Slot } from './content';

/**
 * Tự thay từ trong câu mẫu: mỗi slot là một đoạn nguyên văn trong câu, có vài phương án thay.
 * choice[k] = -1 → giữ nguyên văn; 0..n-1 → dùng alts[n].
 */
export interface Segment {
  text: string;
  /** Chỉ số slot (theo thứ tự trong mảng slots) nếu đoạn này là slot. */
  slot?: number;
  /** true nếu đoạn đã được thay khác nguyên văn. */
  changed?: boolean;
}

/** Vị trí từng slot trong câu (lần xuất hiện đầu, không chồng lên slot trước). -1 nếu không tìm thấy. */
export function slotPositions(en: string, slots: readonly Slot[]): number[] {
  const taken: [number, number][] = [];
  return slots.map((s) => {
    let from = 0;
    for (;;) {
      const i = en.indexOf(s.text, from);
      if (i < 0) return -1;
      const end = i + s.text.length;
      if (!taken.some(([a, b]) => i < b && end > a)) {
        taken.push([i, end]);
        return i;
      }
      from = i + 1;
    }
  });
}

export function optionText(slot: Slot, choice: number): string {
  return choice >= 0 && choice < slot.alts.length ? (slot.alts[choice] as string) : slot.text;
}

/** Chia câu thành các đoạn thường / slot theo lựa chọn hiện tại. */
export function segments(en: string, slots: readonly Slot[], choice: readonly number[] = []): Segment[] {
  const pos = slotPositions(en, slots);
  const order = slots
    .map((s, k) => ({ s, k, at: pos[k] ?? -1 }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at);
  const out: Segment[] = [];
  let cur = 0;
  for (const { s, k, at } of order) {
    if (at > cur) out.push({ text: en.slice(cur, at) });
    const c = choice[k] ?? -1;
    const text = optionText(s, c);
    out.push({ text, slot: k, changed: text !== s.text });
    cur = at + s.text.length;
  }
  if (cur < en.length) out.push({ text: en.slice(cur) });
  return out;
}

/** Câu sau khi thay. */
export function applySlots(en: string, slots: readonly Slot[], choice: readonly number[] = []): string {
  return segments(en, slots, choice)
    .map((s) => s.text)
    .join('');
}

