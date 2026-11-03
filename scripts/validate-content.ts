/**
 * Kiểm tra nội dung trong content/ trước khi commit: đúng cấu trúc, id không trùng, trường bắt buộc không rỗng.
 * Chạy: npm run validate:content. Thoát mã 1 nếu có lỗi.
 * S1 kiểm tra content/tr101/data.json; content/english/ sẽ có schema ở S4.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const errors: string[] = [];
const err = (msg: string) => errors.push(msg);

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

  checkList(file, 'concepts', d.concepts, ['id', 'vi', 'dn'], 'id', checkBai);
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
  const dir = join(ROOT, 'content/english');
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) readJson(`content/english/${f}`);
}

validateTr101();
validateEnglish();

if (errors.length) {
  console.error(`✗ Nội dung có ${errors.length} lỗi:`);
  for (const e of errors.slice(0, 100)) console.error('  - ' + e);
  process.exit(1);
}
console.log('✓ Nội dung hợp lệ.');
