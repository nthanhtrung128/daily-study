/**
 * Kiểm tra nội dung trong content/ trước khi commit: đúng cấu trúc, id không trùng, trường bắt buộc không rỗng.
 * Chạy: npm run validate:content. Thoát mã 1 nếu có lỗi.
 * - content/tr101/data.json: cấu trúc, id, trường bắt buộc.
 * - content/english/*.json: theo JSON Schema trong content/english/schema/ (bộ kiểm tra viết tay ở scripts/lib/english-content.ts),
 *   cộng id duy nhất, không trùng câu tiếng Anh, slot câu mẫu khớp câu, vai hội thoại khớp người nói,
 *   trConcept của đề nói có trong TR101; in số mục theo chủ đề / trình độ.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGLISH_FILES, formatCounts, validateEnglishFile, type Schema, type SchemaRegistry } from './lib/english-content';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const errors: string[] = [];
const err = (msg: string) => errors.push(msg);
/** Id khái niệm TR101, để đề nói kiểm tra trConcept. */
const trConceptIds = new Set<string>();

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown) => isStr(v) && v.trim().length > 0;

function readJson(rel: string): unknown {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch (e) {
    err(`${rel}: không đọc được JSON (${(e as Error).message})`);
    return undefined;
  }
}

/** Kiểm tra một mảng bản ghi: bắt buộc các trường chuỗi không rỗng, id duy nhất (nếu có idKey). */
function checkList(file: string, name: string, list: unknown, required: string[], idKey?: string, extra?: (row: Obj, where: string) => void) {
  if (!Array.isArray(list) || list.length === 0) {
    err(`${file}: "${name}" phải là mảng không rỗng`);
    return;
  }
  const seen = new Set<string>();
  list.forEach((row, i) => {
    const where = `${file} ${name}[${i}]${idKey && isObj(row) && isStr(row[idKey]) ? ` (${row[idKey]})` : ''}`;
    if (!isObj(row)) return err(`${where}: không phải object`);
    for (const k of required) if (!nonEmpty(row[k])) err(`${where}: thiếu "${k}"`);
    if (idKey && isStr(row[idKey])) {
      if (seen.has(row[idKey])) err(`${where}: trùng id`);
      seen.add(row[idKey]);
    }
    extra?.(row, where);
  });
}

function validateTr101() {
  const file = 'content/tr101/data.json';
  const d = readJson(file);
  if (!isObj(d)) return err(`${file}: gốc phải là object`);

  const meta = d.meta;
  const bai = isObj(meta) && isObj(meta.bai) ? meta.bai : undefined;
  if (!isObj(meta) || !nonEmpty(meta.title) || !bai) err(`${file}: meta cần title và bai`);
  const checkBai = (row: Obj, where: string) => {
    if (!bai || !isStr(row.bai) || row.bai === '' || row.bai in bai) return;
    // Cho phép nhiều buổi: "2–3", "3, 6" — từng phần phải có trong meta.bai.
    const parts = row.bai.split(/[,–]/).map((x) => x.trim());
    if (!parts.every((x) => x in bai)) err(`${where}: buổi "${row.bai}" không có trong meta.bai`);
  };

  checkList(file, 'concepts', d.concepts, ['id', 'vi', 'dn'], 'id', (row, where) => {
    checkBai(row, where);
    if (isStr(row.id)) trConceptIds.add(row.id);
  });
  checkList(file, 'gloss', d.gloss, ['en', 'vi']);
  checkList(file, 'quiz', d.quiz, ['id', 'q'], 'id', (row, where) => {
    checkBai(row, where);
    const o = row.o;
    if (!Array.isArray(o) || o.length < 2 || !o.every(nonEmpty)) return err(`${where}: "o" cần ≥ 2 lựa chọn`);
    if (typeof row.a !== 'number' || !Number.isInteger(row.a) || row.a < 0 || row.a >= o.length) err(`${where}: đáp án "a" ngoài phạm vi`);
  });
  checkList(file, 'openq', d.openq, ['id', 'q'], 'id', checkBai);
  checkList(file, 'formulas', d.formulas, ['id', 'name', 'f'], 'id', checkBai);
  checkList(file, 'check', d.check, ['id'], 'id');
}

function validateEnglish() {
  const base = 'content/english';
  const schemaDir = join(ROOT, base, 'schema');
  if (!existsSync(schemaDir)) return err(`${base}/schema: chưa có thư mục schema`);

  const registry: SchemaRegistry = {};
  for (const f of readdirSync(schemaDir).filter((f) => f.endsWith('.schema.json')).sort()) {
    const s = readJson(`${base}/schema/${f}`);
    if (!isObj(s)) continue;
    if (s.$id !== f) err(`${base}/schema/${f}: "$id" phải là "${f}"`);
    registry[f] = s as Schema;
  }

  const known = new Set(ENGLISH_FILES.map((x) => x.file));
  for (const f of readdirSync(join(ROOT, base)).filter((f) => f.endsWith('.json'))) {
    if (!known.has(f)) err(`${base}/${f}: file chưa được khai báo trong ENGLISH_FILES (scripts/lib/english-content.ts)`);
  }

  for (const spec of ENGLISH_FILES) {
    const rel = `${base}/${spec.file}`;
    if (!existsSync(join(ROOT, rel))) {
      if (spec.required) err(`${rel}: thiếu file`);
      continue;
    }
    const data = readJson(rel);
    if (data === undefined) continue;
    const r = validateEnglishFile(spec, data, registry, { trConceptIds });
    r.errors.forEach(err);
    console.log(`  ${spec.file}: ${r.count} mục — ${formatCounts(r.byTopic)} | ${formatCounts(r.byLevel)}`);
  }
}

function validateRoadmap() {
  for (let session = 1; session <= 17; session++) {
    const code = String(session).padStart(2, '0');
    const file = `content/tr-roadmap/m${code}.json`;
    const data = readJson(file);
    const validReview = (value: unknown) => isObj(value) && nonEmpty(value.question) && nonEmpty(value.answer);
    if (!isObj(data)) {
      err(`${file}: gốc phải là object`);
      continue;
    }
    if (data.code !== `M${code}` || !nonEmpty(data.title) || !nonEmpty(data.goal) || !nonEmpty(data.source)) {
      err(`${file}: thiếu mã, tên, nguồn hoặc mục tiêu mô-đun`);
    }
    const expectedCount = code === '04' ? 5 : 4;
    if (!Array.isArray(data.lessons) || data.lessons.length !== expectedCount) {
      err(`${file}: lộ trình yêu cầu ${expectedCount} bài`);
    }
    let number = 0;
    checkList(file, 'lessons', data.lessons, ['id', 'title', 'context', 'explanation', 'example', 'takeaway'], 'id', (row, where) => {
      const expectedId = `trm-${code}-${String(++number).padStart(2, '0')}`;
      if (row.id !== expectedId) err(`${where}: cần mã ${expectedId} theo thứ tự buổi`);
      if (!Array.isArray(row.steps) || !row.steps.length || !row.steps.every(nonEmpty)) err(`${where}: thiếu các bước thực hiện`);
      if (!validReview(row.review)) err(`${where}: phần tự ôn cần câu hỏi và lời giải`);
    });
    const inRange = (value: unknown, max: number) => typeof value === 'number' && value >= 0 && value <= max;
    if (code === '06') {
      const merit = data.merit;
      if (!isObj(merit) || !inRange(merit.budget, 100) || !Array.isArray(merit.cells) || merit.cells.length !== 9
        || !merit.cells.every((cell: unknown) => isObj(cell) && nonEmpty(cell.rating) && nonEmpty(cell.compa)
          && inRange(cell.payroll, 1e9) && inRange(cell.rate, 100))) {
        err(`${file}: cần ngân sách và 9 ô ma trận hợp lệ`);
      }
    }
    if (code === '09') {
      checkList(file, 'sample', data.sample, ['id', 'grade', 'family'], 'id', (row, where) => {
        if (!inRange(row.fte, 1) || row.fte === 0
          || !['salary', 'min', 'midpoint', 'max', 'market'].every((key) => inRange(row[key], 1e6))
          || row.min === 0 || row.market === 0
          || !(Number(row.min) <= Number(row.midpoint) && Number(row.midpoint) <= Number(row.max))
          || row.max === row.min) {
          err(`${where}: mẫu có FTE, số tiền hoặc dải không hợp lệ`);
        }
      });
    }
  }
}

function validateReadings() {
  const file = 'content/reading/articles.json';
  checkList(file, 'articles', readJson(file), ['id', 'region'], 'id', (row, where) => {
    if (!isStr(row.id) || !/^[a-z0-9-]+$/.test(row.id)) err(`${where}: mã bài không hợp lệ`);
    if (!['Việt Nam', 'Quốc tế'].includes(String(row.region))) err(`${where}: nhóm nguồn không hợp lệ`);
    for (const field of ['title', 'question', 'answer']) {
      const pair = row[field];
      if (!isObj(pair) || !nonEmpty(pair.en) || !nonEmpty(pair.vi)) err(`${where}: thiếu bản Anh–Việt cho ${field}`);
    }
    for (const field of ['paragraphs', 'terms']) checkList(file, where + '.' + field, row[field], ['en', 'vi']);
    const source = row.source;
    if (!isObj(source) || !nonEmpty(source.publisher) || !nonEmpty(source.name) || !nonEmpty(source.reason)
      || !isStr(source.url) || !/^https:\/\/[^/]+\/.+/.test(source.url)) err(`${where}: thiếu nguồn tham khảo`);
  });
}

validateReadings();
validateTr101();
validateRoadmap();
validateEnglish();

if (errors.length) {
  console.error(`✗ Nội dung có ${errors.length} lỗi:`);
  for (const e of errors.slice(0, 100)) console.error('  - ' + e);
  process.exit(1);
}
console.log('✓ Nội dung hợp lệ.');
