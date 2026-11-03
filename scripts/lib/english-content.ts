/**
 * Kiểm tra nội dung tiếng Anh (content/english/*.json) theo JSON Schema trong content/english/schema/.
 * Viết tay, không dùng thư viện: chỉ hỗ trợ tập con draft 2020-12 mà các schema của repo dùng.
 * Gặp từ khóa lạ thì báo lỗi, để schema không âm thầm dựa vào thứ bộ kiểm tra bỏ qua.
 * Module thuần (không đọc file) để test được bằng Vitest.
 */

export type Schema = { [key: string]: unknown };
/** Schema theo $id (vd "common.schema.json"). */
export type SchemaRegistry = Record<string, Schema>;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Từ khóa chỉ mang tính chú thích hoặc định nghĩa, không cần kiểm tra. */
const ANNOTATIONS = new Set(['$schema', '$id', '$defs', 'title', 'description', 'examples', '$comment']);
const SUPPORTED = new Set([
  '$ref',
  'type',
  'enum',
  'const',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
]);

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(v: unknown, t: string): boolean {
  const actual = typeOf(v);
  return actual === t || (t === 'number' && actual === 'integer');
}

/** Đếm theo ký tự Unicode (code point) như JSON Schema quy định. */
const strLen = (s: string) => [...s].length;

/** Lấy schema theo JSON Pointer đơn giản "#/$defs/x". */
function resolvePointer(doc: Schema, pointer: string): Schema | undefined {
  if (pointer === '' || pointer === '/') return doc;
  let cur: unknown = doc;
  for (const raw of pointer.replace(/^\//, '').split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObj(cur)) return undefined;
    cur = cur[key];
  }
  return isObj(cur) ? cur : undefined;
}

interface Ctx {
  registry: SchemaRegistry;
  /** $id của tài liệu schema đang đứng (để giải "#/..." tương đối). */
  docId: string;
  errors: string[];
  /** Các nút schema đã kiểm tra từ khóa (để không báo lặp cho từng mục dữ liệu). */
  vetted: WeakSet<Schema>;
}

function resolveRef(ref: string, ctx: Ctx): { schema: Schema; docId: string } | undefined {
  const [file = '', frag = ''] = ref.split('#');
  const docId = file === '' ? ctx.docId : file;
  const doc = ctx.registry[docId];
  if (!doc) return undefined;
  const schema = resolvePointer(doc, frag);
  return schema ? { schema, docId } : undefined;
}

function check(value: unknown, schema: Schema, path: string, ctx: Ctx): void {
  const err = (msg: string) => ctx.errors.push(`${path || '(gốc)'}: ${msg}`);

  if (!ctx.vetted.has(schema)) {
    ctx.vetted.add(schema);
    for (const key of Object.keys(schema)) {
      if (!ANNOTATIONS.has(key) && !SUPPORTED.has(key)) err(`schema dùng từ khóa chưa hỗ trợ "${key}"`);
    }
  }

  if (typeof schema.$ref === 'string') {
    const target = resolveRef(schema.$ref, ctx);
    if (!target) err(`không giải được $ref "${schema.$ref}"`);
    else check(value, target.schema, path, { ...ctx, docId: target.docId });
  }

  if (typeof schema.type === 'string' && !typeMatches(value, schema.type)) {
    // Sai kiểu thì các kiểm tra còn lại vô nghĩa.
    err(`cần kiểu ${schema.type}, nhận ${typeOf(value)}`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    err(`giá trị ${JSON.stringify(value)} không thuộc [${schema.enum.join(', ')}]`);
  }
  if ('const' in schema && value !== schema.const) err(`phải bằng ${JSON.stringify(schema.const)}`);

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && strLen(value) < schema.minLength) err(`ngắn hơn ${schema.minLength} ký tự`);
    if (typeof schema.maxLength === 'number' && strLen(value) > schema.maxLength) err(`dài hơn ${schema.maxLength} ký tự`);
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) {
      err(`"${value}" không khớp mẫu ${schema.pattern}`);
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) err(`nhỏ hơn ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) err(`lớn hơn ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) err(`cần ít nhất ${schema.minItems} phần tử`);
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) err(`tối đa ${schema.maxItems} phần tử`);
    if (schema.uniqueItems === true) {
      const seen = new Set<string>();
      value.forEach((v, i) => {
        const k = JSON.stringify(v);
        if (seen.has(k)) err(`phần tử [${i}] bị trùng`);
        seen.add(k);
      });
    }
    if (isObj(schema.items)) {
      const itemSchema = schema.items;
      value.forEach((v, i) => check(v, itemSchema, `${path}[${i}]`, ctx));
    }
  }

  if (isObj(value)) {
    if (Array.isArray(schema.required)) {
      for (const k of schema.required) if (typeof k === 'string' && !(k in value)) err(`thiếu trường bắt buộc "${k}"`);
    }
    const props = isObj(schema.properties) ? schema.properties : {};
    for (const [k, v] of Object.entries(value)) {
      const sub = props[k];
      if (isObj(sub)) check(v, sub, `${path}.${k}`, ctx);
      else if (schema.additionalProperties === false) err(`trường lạ "${k}"`);
      else if (isObj(schema.additionalProperties)) check(v, schema.additionalProperties, `${path}.${k}`, ctx);
    }
  }
}

/** Kiểm tra value theo schema có $id = docId trong registry. Trả về danh sách lỗi (rỗng = hợp lệ). */
export function validateAgainstSchema(value: unknown, docId: string, registry: SchemaRegistry): string[] {
  const ctx: Ctx = { registry, docId, errors: [], vetted: new WeakSet() };
  const schema = registry[docId];
  if (!schema) return [`không có schema "${docId}"`];
  check(value, schema, '', ctx);
  return ctx.errors;
}

/** Chuẩn hóa để so trùng: chữ thường, bỏ dấu câu cuối, gộp khoảng trắng, thống nhất dấu nháy. */
export function normalizeEn(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface EnglishFileSpec {
  /** Tên file trong content/english/, vd "phrases.json". */
  file: string;
  /** $id schema, vd "phrases.schema.json". */
  schema: string;
  /** Tiền tố id, vd "ph". */
  idPrefix: string;
  /** Các trường văn bản tiếng Anh không được trùng giữa các mục (so sau khi chuẩn hóa). */
  uniqueFields: string[];
  /** Có bắt buộc file tồn tại không (dialogues / speaking-topics để S7). */
  required: boolean;
}

export const ENGLISH_FILES: EnglishFileSpec[] = [
  { file: 'phrases.json', schema: 'phrases.schema.json', idPrefix: 'ph', uniqueFields: ['en', 'example'], required: true },
  { file: 'patterns.json', schema: 'patterns.schema.json', idPrefix: 'pt', uniqueFields: ['en'], required: true },
  { file: 'dialogues.json', schema: 'dialogues.schema.json', idPrefix: 'dl', uniqueFields: ['title'], required: false },
  { file: 'speaking-topics.json', schema: 'speaking-topics.schema.json', idPrefix: 'st', uniqueFields: ['en'], required: false },
];

export interface EnglishReport {
  errors: string[];
  count: number;
  byTopic: Record<string, number>;
  byLevel: Record<string, number>;
}

function countSlotOccurrences(haystack: string, needle: string): number {
  let n = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
}

/** Kiểm tra ngoài schema: id duy nhất, không trùng nội dung, slot của câu mẫu khớp câu. */
function checkSemantics(spec: EnglishFileSpec, items: unknown[], errors: string[]) {
  const ids = new Set<string>();
  const seen: Record<string, Map<string, string>> = {};
  for (const f of spec.uniqueFields) seen[f] = new Map();

  items.forEach((raw, i) => {
    if (!isObj(raw)) return; // schema đã báo
    const id = typeof raw.id === 'string' ? raw.id : `[${i}]`;
    const where = `${spec.file} ${id}`;

    if (typeof raw.id === 'string') {
      if (ids.has(raw.id)) errors.push(`${where}: trùng id`);
      ids.add(raw.id);
      if (!raw.id.startsWith(`${spec.idPrefix}-`)) errors.push(`${where}: id phải bắt đầu bằng "${spec.idPrefix}-"`);
    }

    for (const f of spec.uniqueFields) {
      const v = raw[f];
      if (typeof v !== 'string') continue;
      const key = normalizeEn(v);
      const prev = seen[f]?.get(key);
      if (prev) errors.push(`${where}: "${f}" trùng với ${prev} ("${v}")`);
      else seen[f]?.set(key, id);
    }

    // Câu mẫu: mỗi slot phải xuất hiện đúng một lần trong câu, phương án thay khác bản gốc, slot không chồng nhau.
    if (Array.isArray(raw.slots) && typeof raw.en === 'string') {
      const en = raw.en;
      const texts = new Set<string>();
      raw.slots.forEach((slot, j) => {
        if (!isObj(slot) || typeof slot.text !== 'string') return;
        const n = countSlotOccurrences(en, slot.text);
        if (n !== 1) errors.push(`${where}: slot[${j}] "${slot.text}" xuất hiện ${n} lần trong câu (cần đúng 1)`);
        if (texts.has(slot.text)) errors.push(`${where}: slot[${j}] trùng slot khác`);
        for (const other of texts) {
          if (other.includes(slot.text) || slot.text.includes(other)) errors.push(`${where}: slot[${j}] chồng lên slot "${other}"`);
        }
        texts.add(slot.text);
        if (Array.isArray(slot.alts) && slot.alts.some((a) => typeof a === 'string' && normalizeEn(a) === normalizeEn(slot.text as string))) {
          errors.push(`${where}: slot[${j}] có phương án trùng với chính slot`);
        }
      });
    }
  });
}

/** Kiểm tra một file nội dung tiếng Anh đã parse. */
export function validateEnglishFile(spec: EnglishFileSpec, data: unknown, registry: SchemaRegistry): EnglishReport {
  const errors = validateAgainstSchema(data, spec.schema, registry).map((e) => `${spec.file} ${e}`);
  const report: EnglishReport = { errors, count: 0, byTopic: {}, byLevel: {} };
  const items = isObj(data) && Array.isArray(data.items) ? data.items : [];
  report.count = items.length;
  checkSemantics(spec, items, errors);
  for (const it of items) {
    if (!isObj(it)) continue;
    if (typeof it.topic === 'string') report.byTopic[it.topic] = (report.byTopic[it.topic] ?? 0) + 1;
    if (typeof it.level === 'string') report.byLevel[it.level] = (report.byLevel[it.level] ?? 0) + 1;
  }
  return report;
}

/** Dạng "office 55 · meetings 55 …" để in ra console. */
export function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([k, n]) => `${k} ${n}`)
    .join(' · ');
}
