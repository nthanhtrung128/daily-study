import { describe, expect, it } from 'vitest';
import {
  ENGLISH_FILES,
  normalizeEn,
  validateAgainstSchema,
  validateEnglishFile,
  type EnglishFileSpec,
  type Schema,
  type SchemaRegistry,
} from '../../scripts/lib/english-content';
import common from '../../content/english/schema/common.schema.json';
import phrasesSchema from '../../content/english/schema/phrases.schema.json';
import patternsSchema from '../../content/english/schema/patterns.schema.json';
import dialoguesSchema from '../../content/english/schema/dialogues.schema.json';
import topicsSchema from '../../content/english/schema/speaking-topics.schema.json';
import phrases from '../../content/english/phrases.json';
import patterns from '../../content/english/patterns.json';
import dialogues from '../../content/english/dialogues.json';
import topics from '../../content/english/speaking-topics.json';
import tr101 from '../../content/tr101/data.json';

const registry: SchemaRegistry = {
  'common.schema.json': common as Schema,
  'phrases.schema.json': phrasesSchema as Schema,
  'patterns.schema.json': patternsSchema as Schema,
  'dialogues.schema.json': dialoguesSchema as Schema,
  'speaking-topics.schema.json': topicsSchema as Schema,
};
const spec = (file: string): EnglishFileSpec => {
  const s = ENGLISH_FILES.find((x) => x.file === file);
  if (!s) throw new Error(file);
  return s;
};
const PH = spec('phrases.json');
const PT = spec('patterns.json');
const DL = spec('dialogues.json');
const ST = spec('speaking-topics.json');
const trConceptIds = new Set(tr101.concepts.map((c) => c.id));

const dialogue = (over: Record<string, unknown> = {}) => ({
  id: 'dl-0001',
  title: 'Asking about the bonus',
  situation: 'Nhân viên hỏi về thưởng',
  topic: 'cb-hr',
  level: 'B1',
  roles: [
    { speaker: 'A', name: 'Chuyên viên C&B' },
    { speaker: 'B', name: 'Nhân viên' },
  ],
  lines: [
    { speaker: 'B', en: 'When is the bonus paid?', vi: 'Khi nào trả thưởng?' },
    { speaker: 'A', en: 'In March, with your salary.', vi: 'Tháng Ba, cùng lương.' },
    { speaker: 'B', en: 'Is it taxed?', vi: 'Có bị tính thuế không?' },
    { speaker: 'A', en: 'Yes, like normal income.', vi: 'Có, như thu nhập thường.' },
  ],
  ...over,
});
const topic = (over: Record<string, unknown> = {}) => ({
  id: 'st-0001',
  en: 'Explain compa-ratio.',
  vi: 'Giải thích compa-ratio.',
  topic: 'cb-hr',
  level: 'B2',
  trConcept: 'K047',
  hints: ['Salary divided by midpoint.', 'One means at the midpoint.'],
  useful: ['divided by', 'at the midpoint'],
  opener: 'Compa-ratio is a simple number.',
  ...over,
});

const phrase = (over: Record<string, unknown> = {}) => ({
  id: 'ph-0001',
  en: 'touch base',
  vi: 'trao đổi nhanh',
  example: "Let's touch base on Friday about the bonus file.",
  topic: 'office',
  level: 'B2',
  ...over,
});
const pattern = (over: Record<string, unknown> = {}) => ({
  id: 'pt-0001',
  situation: 'Nhờ giúp',
  en: 'Could you check the overtime figures today?',
  vi: 'Bạn kiểm tra số làm thêm giờ hôm nay được không?',
  slots: [{ text: 'the overtime figures', alts: ['the leave report', 'the payslips'] }],
  topic: 'office',
  level: 'B1',
  ...over,
});

describe('nội dung thật', () => {
  it('phrases.json đạt schema, đủ 600 mục (300 ở S4 + 300 ở S7), đủ 6 chủ đề', () => {
    const r = validateEnglishFile(PH, phrases, registry);
    expect(r.errors).toEqual([]);
    expect(r.count).toBe(600);
    expect(Object.keys(r.byTopic).sort()).toEqual(['cb-hr', 'email', 'interview', 'meetings', 'negotiation', 'office']);
  });

  it('patterns.json đạt schema, đủ 150 mục', () => {
    const r = validateEnglishFile(PT, patterns, registry);
    expect(r.errors).toEqual([]);
    expect(r.count).toBe(150);
    expect(Object.keys(r.byLevel).sort()).toEqual(['B1', 'B2', 'C1']);
  });

  it('dialogues.json đạt schema: 60 bài, 6–12 lượt, câu ngắn, đủ B1–C1, mỗi bài có vai', () => {
    const r = validateEnglishFile(DL, dialogues, registry);
    expect(r.errors).toEqual([]);
    expect(r.count).toBe(60);
    expect(Object.keys(r.byLevel).sort()).toEqual(['B1', 'B2', 'C1']);
    for (const d of dialogues.items) {
      expect(d.lines.length, d.id).toBeGreaterThanOrEqual(6);
      expect(d.lines.length, d.id).toBeLessThanOrEqual(12);
      expect(d.roles.length, d.id).toBeGreaterThanOrEqual(2);
      // Câu vừa để shadowing: không quá 25 từ mỗi lượt.
      for (const l of d.lines) expect(l.en.split(/\s+/).length, `${d.id}: ${l.en}`).toBeLessThanOrEqual(25);
    }
  });

  it('speaking-topics.json đạt schema: 100 đề, 40 đề khái niệm TR, đủ ý chính / cụm nên dùng / câu mở đầu', () => {
    const r = validateEnglishFile(ST, topics, registry, { trConceptIds });
    expect(r.errors).toEqual([]);
    expect(r.count).toBe(100);
    const tr = topics.items.filter((t) => 'trConcept' in t);
    expect(tr).toHaveLength(40);
    expect(new Set(tr.map((t) => t.trConcept)).size).toBe(40);
    for (const t of topics.items) {
      expect(t.hints.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.useful.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.opener.length, t.id).toBeGreaterThan(10);
    }
  });

  it('id liên tục từ 0001 (mã ổn định, thêm mới thì nối tiếp)', () => {
    phrases.items.forEach((it, i) => expect(it.id).toBe(`ph-${String(i + 1).padStart(4, '0')}`));
    patterns.items.forEach((it, i) => expect(it.id).toBe(`pt-${String(i + 1).padStart(4, '0')}`));
    dialogues.items.forEach((it, i) => expect(it.id).toBe(`dl-${String(i + 1).padStart(4, '0')}`));
    topics.items.forEach((it, i) => expect(it.id).toBe(`st-${String(i + 1).padStart(4, '0')}`));
  });
});

describe('bắt lỗi schema', () => {
  const run = (items: unknown[], s = PH) => validateEnglishFile(s, { items }, registry).errors.join('\n');

  it('thiếu trường bắt buộc', () => {
    const row: Record<string, unknown> = phrase();
    delete row.example;
    expect(run([row])).toMatch(/thiếu trường bắt buộc "example"/);
  });

  it('topic, level lạ và trường lạ', () => {
    const out = run([phrase({ topic: 'sports', level: 'A2', extra: 1 })]);
    expect(out).toMatch(/"sports" không thuộc/);
    expect(out).toMatch(/"A2" không thuộc/);
    expect(out).toMatch(/trường lạ "extra"/);
  });

  it('id sai mẫu, sai kiểu, khoảng trắng thừa', () => {
    expect(run([phrase({ id: 'ph-1' })])).toMatch(/không khớp mẫu/);
    expect(run([phrase({ id: 7 })])).toMatch(/cần kiểu string/);
    expect(run([phrase({ en: ' touch base' })])).toMatch(/không khớp mẫu/);
  });

  it('gốc file phải có items', () => {
    expect(validateEnglishFile(PH, [], registry).errors.join()).toMatch(/cần kiểu object/);
    expect(validateEnglishFile(PH, {}, registry).errors.join()).toMatch(/thiếu trường bắt buộc "items"/);
  });

  it('báo từ khóa schema chưa hỗ trợ và $ref hỏng', () => {
    const reg: SchemaRegistry = { 'x.json': { type: 'object', oneOf: [], properties: { a: { $ref: '#/$defs/missing' } } } };
    const out = validateAgainstSchema({ a: 1 }, 'x.json', reg).join('\n');
    expect(out).toMatch(/chưa hỗ trợ "oneOf"/);
    expect(out).toMatch(/không giải được \$ref/);
  });
});

describe('bắt lỗi ngoài schema', () => {
  it('trùng id, trùng en (không phân biệt hoa thường, dấu câu)', () => {
    const items = [phrase(), phrase({ en: 'Touch base.', example: 'Another example sentence here.' })];
    const out = validateEnglishFile(PH, { items }, registry).errors.join('\n');
    expect(out).toMatch(/trùng id/);
    expect(out).toMatch(/"en" trùng với ph-0001/);
  });

  it('slot không có trong câu, xuất hiện 2 lần, phương án trùng gốc', () => {
    const bad = [
      pattern({ slots: [{ text: 'the payroll', alts: ['a', 'b'] }] }),
      pattern({ id: 'pt-0002', en: 'Check the file and the file again.', slots: [{ text: 'the file', alts: ['a', 'b'] }] }),
      pattern({ id: 'pt-0003', en: 'Send the report now.', slots: [{ text: 'the report', alts: ['The report', 'the memo'] }] }),
    ];
    const out = validateEnglishFile(PT, { items: bad }, registry).errors.join('\n');
    expect(out).toMatch(/pt-0001: slot\[0\] "the payroll" xuất hiện 0 lần/);
    expect(out).toMatch(/pt-0002: slot\[0\] "the file" xuất hiện 2 lần/);
    expect(out).toMatch(/pt-0003: slot\[0\] có phương án trùng/);
  });

  it('slot cần ≥ 2 phương án, không trùng nhau', () => {
    const out = validateEnglishFile(PT, { items: [pattern({ slots: [{ text: 'the overtime figures', alts: ['x', 'x'] }] })] }, registry).errors.join('\n');
    expect(out).toMatch(/bị trùng/);
  });
});

describe('hội thoại và đề nói', () => {
  const errs = (s: EnglishFileSpec, items: unknown[]) => validateEnglishFile(s, { items }, registry, { trConceptIds }).errors.join('\n');

  it('hội thoại hợp lệ không báo lỗi; roles là tùy chọn (tương thích S4)', () => {
    expect(errs(DL, [dialogue()])).toBe('');
    const noRoles: Record<string, unknown> = dialogue();
    delete noRoles.roles;
    expect(errs(DL, [noRoles])).toBe('');
  });

  it('người nói thiếu vai, vai trùng, vai không nói, chỉ một người nói', () => {
    const d = dialogue();
    expect(errs(DL, [dialogue({ roles: [d.roles[0], { speaker: 'C', name: 'Quản lý' }] })])).toMatch(/người nói "B" chưa có trong roles/);
    expect(errs(DL, [dialogue({ roles: [d.roles[0], d.roles[0]] })])).toMatch(/trùng nhãn "A"/);
    expect(errs(DL, [dialogue({ roles: [...d.roles, { speaker: 'C', name: 'Quản lý' }] })])).toMatch(/vai "C" không nói lượt nào/);
    const solo = d.lines.map((l) => ({ ...l, speaker: 'A' }));
    const out = errs(DL, [dialogue({ lines: solo, roles: [d.roles[0], { speaker: 'B', name: 'Nhân viên' }] })]);
    expect(out).toMatch(/ít nhất 2 người nói/);
    expect(out).toMatch(/vai "B" không nói lượt nào/);
  });

  it('trùng tiêu đề hội thoại', () => {
    expect(errs(DL, [dialogue(), dialogue({ id: 'dl-0002', title: 'asking about the bonus!' })])).toMatch(/"title" trùng với dl-0001/);
  });

  it('đề nói: trConcept phải có trong TR101, đúng mẫu K###', () => {
    expect(errs(ST, [topic()])).toBe('');
    expect(errs(ST, [topic({ trConcept: 'K999' })])).toMatch(/trConcept "K999" không có trong/);
    expect(errs(ST, [topic({ trConcept: 'compa' })])).toMatch(/không khớp mẫu/);
  });

  it('đề nói: cụm nên dùng trùng nhau, câu mở đầu trùng đề khác, trường lạ', () => {
    expect(errs(ST, [topic({ useful: ['divided by', 'Divided by.'] })])).toMatch(/useful\[1\] trùng/);
    const two = [topic(), topic({ id: 'st-0002', en: 'Explain market index.' })];
    expect(errs(ST, two)).toMatch(/"opener" trùng với st-0001/);
    expect(errs(ST, [topic({ tips: [] })])).toMatch(/trường lạ "tips"/);
  });
});

describe('normalizeEn', () => {
  it('bỏ khác biệt hoa thường, dấu cuối, khoảng trắng, nháy cong', () => {
    expect(normalizeEn('  I’m  On Track!  ')).toBe("i'm on track");
  });
});
