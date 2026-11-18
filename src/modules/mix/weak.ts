import type { LeitnerState } from '../../core/leitner';
import { pickSentences, type MissMap } from '../../core/misswords';
import { rankWeak } from '../../core/weak';
import { EN_ITEMS, type EnItem } from '../english/content';
import { DICT_ITEMS, fitsLength, type DictItem } from '../english/dictation';
import { EN_TIME } from '../english/plan';
import { SAY_ITEMS, sayId, type SayItem } from '../english/speech/sayItems';
import { ITEMS, type TrItem } from '../tr/items';
import { TIME } from '../tr/plan';
import { DICT_SECS, SAY_SECS, dictExtra, type DailyEntry } from './plan';

/**
 * Phiên "Ôn điểm yếu": (a) mục TR / EN yếu nhất theo `core/weak.ts`, yếu nhất trước;
 * (b) câu chứa các từ hay nói / nghe sai (`core/misswords.ts`), luân phiên nghe chép – nói có chấm.
 * Trả về `DailyEntry[]` để chạy bằng chính `DailySession` (thẻ và luồng chấm của phiên hằng ngày).
 */
export const WEAK_MAX_ITEMS = 12;
export const WEAK_MAX_SENTENCES = 4;

export interface WeakOptions {
  trItems?: readonly TrItem[];
  enItems?: readonly EnItem[];
  dictItems?: readonly DictItem[];
  sayItems?: readonly SayItem[];
  /** Có nhận giọng nói không (không có thì mọi câu đều là nghe chép). */
  canSpeak?: boolean;
}

export function planWeak(stateOf: (id: string) => LeitnerState | undefined, now: number, miss: MissMap, o: WeakOptions = {}): DailyEntry[] {
  const all: (TrItem | EnItem)[] = [...(o.trItems ?? ITEMS), ...(o.enItems ?? EN_ITEMS)];
  const out: DailyEntry[] = rankWeak(all, stateOf, now, WEAK_MAX_ITEMS).map((item): DailyEntry =>
    'ph' in item || 'pt' in item
      ? { lane: 'en', tier: 'wrong', secs: EN_TIME[item.type], item }
      : { lane: 'tr', tier: 'wrong', secs: TIME[item.type], item },
  );
  const taken = new Set(out.map((e) => e.item.id));
  // Câu có thẻ gốc đã nằm trong phiên thì bỏ (tránh chấm một thẻ hai lần).
  const pool = (o.dictItems ?? DICT_ITEMS).filter((d) => !d.id || !taken.has(d.id));
  const say = new Map((o.sayItems ?? SAY_ITEMS).map((s) => [s.id, s]));
  pickSentences(miss, pool, WEAK_MAX_SENTENCES, (d) => fitsLength(d.en)).forEach((d, k) => {
    const s = o.canSpeak && k % 2 === 1 ? say.get(sayId(d.key)) : undefined;
    out.push(s ? { lane: 'en', tier: 'extra', secs: SAY_SECS, item: { kind: 'say', id: s.id, item: s } } : { lane: 'en', tier: 'extra', secs: DICT_SECS, item: dictExtra(d) });
  });
  return out;
}
