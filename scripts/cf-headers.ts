/**
 * Đọc file `_headers` kiểu Cloudflare Pages và tính header cho một đường dẫn.
 * Dùng để `vite preview` (và test Playwright) chạy với đúng header như khi deploy.
 * Hỗ trợ phần Cloudflare dùng: dòng đường dẫn (có `*`, `:tên`), dòng `Tên: giá trị` thụt lề,
 * `! Tên` để bỏ header đã đặt ở quy tắc trước, nhiều quy tắc khớp thì nối giá trị bằng ", ".
 */
export interface HeaderRule {
  pattern: string;
  set: [string, string][];
  unset: string[];
}

export function parseHeadersFile(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  let cur: HeaderRule | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      cur = { pattern: line.trim(), set: [], unset: [] };
      rules.push(cur);
      continue;
    }
    if (!cur) throw new Error(`_headers: dòng header không thuộc đường dẫn nào: "${line.trim()}"`);
    const t = line.trim();
    if (t.startsWith('!')) {
      cur.unset.push(t.slice(1).trim().toLowerCase());
      continue;
    }
    const i = t.indexOf(':');
    if (i <= 0) throw new Error(`_headers: dòng không hợp lệ: "${t}"`);
    cur.set.push([t.slice(0, i).trim(), t.slice(i + 1).trim()]);
  }
  return rules;
}

function toRegExp(pattern: string): RegExp {
  const body = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => {
      if (part === '*') return '.*';
      if (/^:[A-Za-z]\w*$/.test(part)) return '[^/]+';
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${body}$`);
}

/** Header (tên viết thường) áp cho `path` (không gồm query). */
export function headersForPath(rules: HeaderRule[], path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rules) {
    if (!toRegExp(r.pattern).test(path)) continue;
    for (const name of r.unset) delete out[name];
    for (const [name, value] of r.set) {
      const k = name.toLowerCase();
      out[k] = out[k] ? `${out[k]}, ${value}` : value;
    }
  }
  return out;
}
