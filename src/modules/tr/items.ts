import { CALC, type CalcDef } from './calc';
import { DATA, baiOf, type Concept, type Formula, type Gloss, type OpenQ, type Quiz } from './data';

/** Ngân hàng mục ôn TR. Id lưu trong IndexedDB có tiền tố "tr:" để không đụng module tiếng Anh. */
export type TrItem =
  | { id: string; type: 'flash'; bai: string[]; c: Concept }
  | { id: string; type: 'formula'; bai: string[]; f: Formula }
  | { id: string; type: 'quiz'; bai: string[]; q: Quiz }
  | { id: string; type: 'open'; bai: string[]; o: OpenQ }
  | { id: string; type: 'term'; bai: string[]; g: Gloss }
  | { id: string; type: 'calc'; bai: string[]; calc: CalcDef };

export type TrType = TrItem['type'];

export const trId = (raw: string) => `tr:${raw}`;

export function buildItems(): TrItem[] {
  const out: TrItem[] = [];
  for (const c of DATA.concepts) out.push({ id: trId(c.id), type: 'flash', bai: baiOf(c.bai), c });
  for (const f of DATA.formulas) out.push({ id: trId(f.id), type: 'formula', bai: baiOf(f.bai), f });
  for (const q of DATA.quiz) out.push({ id: trId(q.id), type: 'quiz', bai: baiOf(q.bai), q });
  for (const o of DATA.openq) out.push({ id: trId(o.id), type: 'open', bai: baiOf(o.bai), o });
  for (const g of DATA.gloss) {
    if (/ít phổ biến/.test(g.note)) continue;
    out.push({ id: trId(`G${String(g.n).padStart(3, '0')}`), type: 'term', bai: [], g });
  }
  for (const c of CALC) out.push({ id: trId(c.id), type: 'calc', bai: baiOf(c.bai), calc: c });
  return out;
}

export const ITEMS: readonly TrItem[] = buildItems();
export const ITEM_BY_ID: ReadonlyMap<string, TrItem> = new Map(ITEMS.map((i) => [i.id, i]));

export function titleOf(it: TrItem): string {
  switch (it.type) {
    case 'flash': return it.c.vi;
    case 'formula': return it.f.name;
    case 'term': return it.g.en;
    case 'quiz': return it.q.q;
    case 'calc': return `Bài tính: ${it.calc.name}`;
    case 'open': return it.o.q;
  }
}
