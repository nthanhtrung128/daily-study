export const draftKey = 'tr.capstone.draft';
export const emptyDraft = { source: '', costs: ['', '', '', ''], plan: '', memo: '', assessment: '' };
export type CapstoneDraft = typeof emptyDraft;

export function readDraft(v: unknown): CapstoneDraft | undefined {
  if (!v || typeof v !== 'object') return;
  const d = v as Partial<CapstoneDraft>;
  if (typeof d.source !== 'string' || !['', 'X', 'Y'].includes(d.source) ||
    typeof d.plan !== 'string' || !['', 'A', 'B'].includes(d.plan) ||
    typeof d.memo !== 'string' || d.memo.length > 1500 || typeof d.assessment !== 'string' ||
    !['', 'Đã làm được', 'Cần luyện thêm'].includes(d.assessment) || !Array.isArray(d.costs) ||
    d.costs.length !== 4 || !d.costs.every((c) => typeof c === 'string' && c.length <= 10)) return;
  return d as CapstoneDraft;
}
