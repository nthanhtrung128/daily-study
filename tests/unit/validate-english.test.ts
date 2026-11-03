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
  it('phrases.json đạt schema, đủ 300 mục, đủ 6 chủ đề', () => {
    const r = validateEnglishFile(PH, phrases, registry);
    expect(r.errors).toEqual([]);
    expect(r.count).toBe(300);
    expect(Object.keys(r.byTopic).sort()).toEqual(['cb-hr', 'email', 'interview', 'meetings', 'negotiation', 'office']);
  });

  it('patterns.json đạt schema, đủ 150 mục', () => {
    const r = validateEnglishFile(PT, patterns, registry);
    expect(r.errors).toEqual([]);
    expect(r.count).toBe(150);
    expect(Object.keys(r.byLevel).sort()).toEqual(['B1', 'B2', 'C1']);
  });

  it('id liên tục từ 0001 (mã ổn định, thêm mới thì nối tiếp)', () => {
    phrases.items.forEach((it, i) => expect(it.id).toBe(`ph-${String(i + 1).padStart(4, '0')}`));
    patterns.items.forEach((it, i) => expect(it.id).toBe(`pt-${String(i + 1).padStart(4, '0')}`));
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

describe('normalizeEn', () => {
  it('bỏ khác biệt hoa thường, dấu cuối, khoảng trắng, nháy cong', () => {
    expect(normalizeEn('  I’m  On Track!  ')).toBe("i'm on track");
  });
});
