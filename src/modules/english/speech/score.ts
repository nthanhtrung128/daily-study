import type { Grade } from '../../../core/leitner';

/**
 * Chấm câu nói: chuẩn hóa câu đích và câu nhận được → so từng từ (căn chỉnh Levenshtein theo từ)
 * → trạng thái từng từ (đúng / sai / thiếu) + từ thừa → điểm %.
 *
 * Chuẩn hóa (áp dụng cho cả hai phía nên luôn đối xứng):
 * - chữ thường, bỏ dấu câu, dấu nháy cong → thẳng, gạch nối tách từ ("follow-up" = "follow up");
 * - viết tắt: I'm = I am, don't = do not, can't = cannot = can not, won't = will not, gonna = going to…
 *   "'s" sau đại từ / từ hỏi = is hoặc has, "'d" = would hoặc had (khớp một trong hai);
 * - số: "15" = "fifteen", "1,530" = "one thousand five hundred thirty", "12.5" = "twelve point five",
 *   "15%" = "fifteen percent", "$200" = "two hundred dollars", "3rd" = "third", "9:30" = "nine thirty";
 * - vài biến thể chính tả: ok/okay, e-mail/email, -ise/-ize, a.m./am.
 * Từ đệm ("um", "uh", "er", "ah"…) bị bỏ qua ở cả hai phía.
 */

export interface Token {
  /** Dạng chuẩn. */
  w: string;
  /** Dạng tương đương (vd "'s" → is/has). */
  alt?: readonly string[];
  /** Chỉ số từ hiển thị gốc mà token này thuộc về. */
  src: number;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES: [number, string][] = [
  [1e12, 'trillion'],
  [1e9, 'billion'],
  [1e6, 'million'],
  [1e3, 'thousand'],
];

function below1000(n: number): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) out.push(ONES[h] as string, 'hundred');
  if (r) {
    if (r < 20) out.push(ONES[r] as string);
    else {
      out.push(TENS[Math.floor(r / 10)] as string);
      if (r % 10) out.push(ONES[r % 10] as string);
    }
  }
  return out;
}

/** Số nguyên không âm → các từ tiếng Anh ("1530" → one thousand five hundred thirty). */
export function intToWords(n: number): string[] {
  if (!Number.isFinite(n) || n < 0) return [];
  n = Math.floor(n);
  if (n === 0) return ['zero'];
  if (n >= 1e15) return String(n).split('').map((d) => ONES[Number(d)] as string);
  const out: string[] = [];
  let rest = n;
  for (const [v, name] of SCALES) {
    if (rest >= v) {
      out.push(...below1000(Math.floor(rest / v)), name);
      rest %= v;
    }
  }
  out.push(...below1000(rest));
  return out;
}

const ORD_IRREG: Record<string, string> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
};
function ordinal(words: string[]): string[] {
  const last = words[words.length - 1] ?? '';
  const ord = ORD_IRREG[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return [...words.slice(0, -1), ord];
}

/** "12.5" → twelve point five; "0.75" → zero point seven five. */
function decimalWords(s: string): string[] {
  const [int = '0', frac = ''] = s.split('.');
  const out = intToWords(Number(int || '0'));
  if (frac) out.push('point', ...frac.split('').map((d) => ONES[Number(d)] as string));
  return out;
}

const CURRENCY: Record<string, string> = { $: 'dollars', '€': 'euros', '£': 'pounds', '¥': 'yen', '₫': 'dong' };

/** Một "từ" có chữ số → từ. Trả về null nếu không phải số. */
export function numberWords(raw: string): string[] | null {
  let s = raw;
  let cur: string | null = null;
  const c0 = s[0] ?? '';
  if (c0 in CURRENCY) {
    cur = CURRENCY[c0] as string;
    s = s.slice(1);
  }
  let pct = false;
  if (s.endsWith('%')) {
    pct = true;
    s = s.slice(0, -1);
  }
  // Giờ: 9:30, 10:00
  let m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) {
    const mm = Number(m[2]);
    const hw = intToWords(Number(m[1]));
    if (mm === 0) return hw;
    return [...hw, ...(mm < 10 ? ['oh', ...intToWords(mm)] : intToWords(mm))];
  }
  m = /^(\d+)(st|nd|rd|th)$/.exec(s);
  if (m) return ordinal(intToWords(Number(m[1])));
  // Hậu tố k/m/bn: 50k, 2m
  m = /^(\d+(?:\.\d+)?)(k|m|bn)$/.exec(s);
  let scale: string | null = null;
  if (m) {
    s = m[1] as string;
    scale = m[2] === 'k' ? 'thousand' : m[2] === 'm' ? 'million' : 'billion';
  }
  if (!/^\d[\d,]*(\.\d+)?$/.test(s)) return null;
  // Dấu phẩy nhóm nghìn kiểu Anh: 1,530 / 12,000,000
  if (s.includes(',')) {
    if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return null;
    s = s.replace(/,/g, '');
  }
  const out = decimalWords(s);
  if (scale) out.push(scale);
  if (pct) out.push('percent');
  if (cur) out.push(cur);
  return out;
}

/** Viết tắt có dạng cố định. */
const FIXED: Record<string, string[]> = {
  "won't": ['will', 'not'],
  "can't": ['can', 'not'],
  cannot: ['can', 'not'],
  "shan't": ['shall', 'not'],
  "ain't": ['is', 'not'],
  "let's": ['let', 'us'],
  "y'all": ['you', 'all'],
  gonna: ['going', 'to'],
  wanna: ['want', 'to'],
  gotta: ['got', 'to'],
  "'cause": ['because'],
  cos: ['because'],
  okay: ['ok'],
  'e-mail': ['email'],
  'e-mails': ['emails'],
  'per-cent': ['percent'],
  'a.m.': ['am'],
  'p.m.': ['pm'],
  'i.e.': ['ie'],
  'e.g.': ['eg'],
};

/** Từ mà "'s" phía sau là is/has (không phải sở hữu). */
const S_IS = new Set([
  'it', 'that', 'he', 'she', 'what', 'there', 'here', 'who', 'where', 'how', 'when', 'why', 'this',
  'everyone', 'everything', 'everybody', 'nothing', 'something', 'someone', 'somebody', 'nobody', 'anyone',
]);

const FILLERS = new Set(['um', 'uh', 'er', 'erm', 'uhm', 'hmm', 'mm', 'ah', 'eh', 'hm']);

type Part = { w: string; alt?: readonly string[] };

/** Bỏ dấu câu ở hai đầu, giữ ' . % $ trong từ để xử lý viết tắt / số. */
function stripEdges(w: string): string {
  return w.replace(/^[^\p{L}\p{N}$€£¥₫']+/u, '').replace(/[^\p{L}\p{N}%']+$/u, '').replace(/^'+|'+$/g, '');
}

/** -ise/-ize (Anh/Mỹ) — chuẩn về -ize. */
const izeForm = (w: string): string => w.replace(/is(e|es|ed|ing|ation|ations)$/, 'iz$1');

/** Một từ hiển thị → các phần chuẩn hóa. */
function expandWord(rawIn: string): Part[] {
  const lower = rawIn.toLowerCase().replace(/[‘’ʼ`´]/g, "'");
  if (FIXED[lower]) return FIXED[lower].map((w) => ({ w }));
  const raw = stripEdges(lower);
  if (!raw) return [];
  if (FIXED[raw]) return FIXED[raw].map((w) => ({ w }));
  const num = numberWords(raw);
  if (num) return num.map((w) => ({ w }));
  // Gạch nối / gạch chéo: tách thành nhiều từ.
  if (/[-–—/]/.test(raw)) return raw.split(/[-–—/]+/).flatMap(expandWord);
  if (raw.includes('.')) return raw.split('.').flatMap(expandWord);
  let m = /^(.+)n't$/.exec(raw);
  if (m) return [...expandWord(m[1] as string), { w: 'not' }];
  m = /^(.+)'(m|re|ve|ll|d|s)$/.exec(raw);
  if (m) {
    const base = m[1] as string;
    const suf = m[2];
    const head = expandWord(base);
    if (suf === 'm') return [...head, { w: 'am' }];
    if (suf === 're') return [...head, { w: 'are' }];
    if (suf === 've') return [...head, { w: 'have' }];
    if (suf === 'll') return [...head, { w: 'will' }];
    if (suf === 'd') return [...head, { w: 'would', alt: ['had'] }];
    if (S_IS.has(base)) return [...head, { w: 'is', alt: ['has'] }];
    // Sở hữu ("company's"): bỏ nháy, giữ một từ.
    return [{ w: izeForm(`${base}s`) }];
  }
  const w = raw.replace(/'/g, '');
  if (!/[\p{L}\p{N}]/u.test(w)) return [];
  return [{ w: izeForm(w) }];
}

/** Gộp "and" trong số đọc kiểu Anh: "one hundred and fifty" = "one hundred fifty". */
const NUM_WORDS = new Set([...ONES, ...TENS.filter(Boolean), 'hundred', 'thousand', 'million', 'billion']);

/** Tách câu thành các từ hiển thị (giữ dấu câu để hiển thị lại). */
export function displayWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Chuẩn hóa một câu thành token (kèm chỉ số từ hiển thị). */
export function tokenize(text: string, opts: { dropFillers?: boolean } = {}): Token[] {
  const words = displayWords(text);
  const out: Token[] = [];
  words.forEach((dw, src) => {
    for (const p of expandWord(dw)) {
      if (opts.dropFillers && FILLERS.has(p.w)) continue;
      out.push({ ...p, src });
    }
  });
  // "hundred and fifty" → bỏ "and"
  return out.filter((t, i) => !(t.w === 'and' && /hundred|thousand|million|billion/.test(out[i - 1]?.w ?? '') && NUM_WORDS.has(out[i + 1]?.w ?? '')));
}

/** Chuỗi chuẩn hóa (để so sánh / hiển thị debug). */
export const normalize = (text: string): string =>
  tokenize(text)
    .map((t) => t.w)
    .join(' ');

export const tokEq = (a: Token, b: Token): boolean =>
  a.w === b.w || !!a.alt?.includes(b.w) || !!b.alt?.includes(a.w) || !!a.alt?.some((x) => b.alt?.includes(x));

export type Op =
  | { op: 'ok'; ref: number; hyp: number }
  | { op: 'sub'; ref: number; hyp: number }
  | { op: 'del'; ref: number }
  | { op: 'ins'; hyp: number };

/** Căn chỉnh hai dãy token kiểu Levenshtein (thay = xóa = chèn = 1). Ưu tiên khớp khi hòa. */
export function align(ref: readonly Token[], hyp: readonly Token[]): Op[] {
  const n = ref.length;
  const m = hyp.length;
  const W = m + 1;
  const d = new Uint32Array((n + 1) * W);
  for (let i = 0; i <= n; i++) d[i * W] = i;
  for (let j = 0; j <= m; j++) d[j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const c = tokEq(ref[i - 1] as Token, hyp[j - 1] as Token) ? 0 : 1;
      d[i * W + j] = Math.min((d[(i - 1) * W + j - 1] as number) + c, (d[(i - 1) * W + j] as number) + 1, (d[i * W + j - 1] as number) + 1);
    }
  }
  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const cur = d[i * W + j] as number;
    if (i > 0 && j > 0) {
      const eq = tokEq(ref[i - 1] as Token, hyp[j - 1] as Token);
      if (cur === (d[(i - 1) * W + j - 1] as number) + (eq ? 0 : 1)) {
        ops.push({ op: eq ? 'ok' : 'sub', ref: i - 1, hyp: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && cur === (d[(i - 1) * W + j] as number) + 1) {
      ops.push({ op: 'del', ref: i - 1 });
      i--;
    } else {
      ops.push({ op: 'ins', hyp: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}

export type WordStatus = 'ok' | 'wrong' | 'missing';

/** Một từ của câu đích sau khi chấm. */
export interface WordMark {
  text: string;
  status: WordStatus;
  /** Từ nghe được thay cho từ này (khi sai). */
  heard?: string;
  /** Từ thừa nói thêm ngay trước từ này. */
  extraBefore?: string[];
}

export interface ScoreResult {
  /** 0–100. */
  score: number;
  words: WordMark[];
  /** Từ thừa ở cuối câu. */
  extraAfter: string[];
  /** Số token đích / đúng / sai / thiếu / thừa. */
  n: number;
  ok: number;
  sub: number;
  del: number;
  ins: number;
  transcript: string;
}

/** Từ thừa trừ nửa điểm (nói thêm "so", "actually" ít nghiêm trọng bằng nói sai / thiếu). */
export const INSERT_WEIGHT = 0.5;

/** Chấm câu nói `heard` so với câu đích `target`. */
export function scoreSpeech(target: string, heard: string): ScoreResult {
  const words = displayWords(target);
  const hwords = displayWords(heard);
  const ref = tokenize(target, { dropFillers: true });
  const hyp = tokenize(heard, { dropFillers: true });
  const ops = align(ref, hyp);

  const perWord = words.map(() => ({ ok: 0, bad: 0, del: 0, heard: [] as number[], extra: [] as number[] }));
  const extraAfter: number[] = [];
  let ok = 0;
  let sub = 0;
  let del = 0;
  let ins = 0;
  // Một từ nói ra có thể sinh nhiều token ("I'm" → i am): ghi chỉ số từ nghe được, bỏ trùng liền nhau.
  const pushSrc = (arr: number[], k: number) => {
    const src = (hyp[k] as Token).src;
    if (arr[arr.length - 1] !== src) arr.push(src);
  };
  const heardText = (arr: readonly number[]) => arr.map((s) => stripEdges(hwords[s] ?? '') || (hwords[s] ?? '')).filter(Boolean);

  ops.forEach((o, k) => {
    if (o.op === 'ins') {
      ins++;
      // Gắn từ thừa vào trước từ đích kế tiếp; không còn từ nào thì để cuối câu.
      const next = ops.slice(k + 1).find((x) => x.op !== 'ins') as Exclude<Op, { op: 'ins' }> | undefined;
      const tgt = next ? perWord[(ref[next.ref] as Token).src] : undefined;
      pushSrc(tgt ? tgt.extra : extraAfter, o.hyp);
      return;
    }
    const pw = perWord[(ref[o.ref] as Token).src];
    if (!pw) return;
    if (o.op === 'ok') {
      ok++;
      pw.ok++;
    } else if (o.op === 'sub') {
      sub++;
      pw.bad++;
      pushSrc(pw.heard, o.hyp);
    } else {
      del++;
      pw.del++;
    }
  });

  const marks: WordMark[] = words.map((text, i) => {
    const pw = perWord[i] as (typeof perWord)[number];
    const total = pw.ok + pw.bad + pw.del;
    const status: WordStatus = total === 0 || pw.ok === total ? 'ok' : pw.del === total ? 'missing' : 'wrong';
    const mark: WordMark = { text, status };
    if (status === 'wrong' && pw.heard.length) mark.heard = heardText(pw.heard).join(' ');
    if (pw.extra.length) mark.extraBefore = heardText(pw.extra);
    return mark;
  });

  const n = ref.length;
  const raw = n ? (n - sub - del - INSERT_WEIGHT * ins) / n : 0;
  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);
  return { score, words: marks, extraAfter: heardText(extraAfter), n, ok, sub, del, ins, transcript: heard.trim() };
}

/**
 * Ngưỡng chấm Leitner theo điểm (giả định, chỉnh ở đây):
 * ≥ 90% = Nhớ rõ (2), 60–89% = Mơ hồ (1), < 60% = Quên (0).
 */
export const GRADE_GOOD = 90;
export const GRADE_FAIR = 60;
export function gradeForScore(score: number): Grade {
  return score >= GRADE_GOOD ? 2 : score >= GRADE_FAIR ? 1 : 0;
}
export const GRADE_VI = ['Quên', 'Mơ hồ', 'Nhớ rõ'] as const;

/** Chọn bản nhận giọng khớp nhất trong các phương án (maxAlternatives). */
export function bestOf(target: string, alternatives: readonly string[]): ScoreResult {
  let best: ScoreResult | null = null;
  for (const a of alternatives) {
    const r = scoreSpeech(target, a);
    if (!best || r.score > best.score) best = r;
  }
  return best ?? scoreSpeech(target, '');
}
