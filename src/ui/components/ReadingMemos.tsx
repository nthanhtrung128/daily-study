import { useRef, useState } from 'react';
import { db } from '../../core/db';
import { fold, matchesAll, queryTokens } from '../../core/fold';
import { readingMemoSource, type MemoState } from '../../modules/tr/readingMemos';
import { lessonHref } from '../routes';
import { useFocusOnMount } from '../useFocusOnMount';

export function MemoBook({ notes, query, onQuery, selected }: {
  selected: string | null;
  notes: MemoState;
  query: string;
  onQuery: (query: string) => void;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const source = selected ? readingMemoSource(selected) : undefined;
  if (selected && source?.recall) return (
    <section className="panel stack roadmap-reader" aria-labelledby="memo-book-title">
      <div><a className="btn ghost roadmap-link" href="#lo-trinh?memo=1">Về sổ memo</a></div>
      <header>
        <p className="eyebrow">{source.module.code} · {source.lesson.title}</p>
        <h1 className="h-page" id="memo-book-title" ref={heading} tabIndex={-1}>Memo lần tự thử</h1>
      </header>
      <LessonMemo id={selected} notes={notes} title={source.recall.label} />
      <div><a className="btn ghost roadmap-link" href={source.recall.href}>Làm lại tình huống này</a></div>
    </section>
  );
  const tokens = queryTokens(query);
  const results = notes?.filter(({ module, lesson, recall, text }) =>
    matchesAll(fold([module.code, module.title, lesson.title, recall?.label, text].join(' ')), tokens),
  ) ?? [];
  return (
    <section className="panel stack" aria-labelledby="memo-book-title">
      <div><a className="btn ghost roadmap-link" href="#lo-trinh">Về lộ trình</a></div>
      <h1 className="h-page" id="memo-book-title" ref={heading} tabIndex={-1}>Sổ memo bài học</h1>
      {notes == null ? <p role="status">{notes === null ? 'Chưa đọc được memo từ bộ nhớ máy.' : 'Đang đọc memo…'}</p>
        : notes.length === 0 ? <p>Chưa có memo. Bạn có thể ghi khi đọc bài trong lộ trình hoặc sau khi tự thử ở Đọc thêm.</p>
        : <>
          <label className="field">
            <span>Tìm theo bài, mô-đun hoặc nội dung memo</span>
            <input type="search" value={query} onChange={(event) => onQuery(event.target.value)} />
          </label>
          <p className="hint" role="status">{results.length ? `${results.length} memo · Mới sửa trước` : 'Không tìm thấy memo phù hợp.'}</p>
          <ul className="memo-list" role="list">
            {results.map(({ id, text, lesson, module, recall }) => {
              const href = recall ? '#lo-trinh?memo=1&lan=' + encodeURIComponent(id) : lessonHref(id) + '&memo=1';
              return (
                <li key={id}>
                  <span className="eyebrow">{module.code} · {module.title}</span>
                  <a className="memo-source" href={href}>{lesson.title}{recall && ' · ' + recall.label}</a>
                  <p className="memo-excerpt">{text}</p>
                </li>
              );
            })}
          </ul>
        </>}
    </section>
  );
}

export function LessonMemo({ id, notes, title = 'Memo của bài', prompt }: {
  id: string; notes: MemoState; title?: string; prompt?: string;
}) {
  const stored = notes?.find((note) => note.id === id)?.text ?? '';
  const [draft, setDraft] = useState<string>();
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const latest = useRef(0);
  const editing = focused || state === 'saving' || state === 'error';
  const value = editing ? draft ?? stored : stored;

  async function save(text: string) {
    const revision = ++latest.current;
    setDraft(text);
    setState('saving');
    try {
      if (text.trim()) await db.notes.put({ id, text, at: Date.now() });
      else await db.notes.delete(id);
      if (revision === latest.current) setState('saved');
    } catch {
      if (revision === latest.current) setState('error');
    }
  }

  let message = 'Tự lưu trên máy khi bạn viết.';
  if (notes === null) message = 'Chưa mở được bộ nhớ máy.';
  else if (notes === undefined) message = 'Đang đọc memo…';
  else if (state === 'error') message = 'Chưa lưu được. Hãy thử lại.';
  else if (state === 'saving') message = 'Đang lưu…';
  else if (state === 'saved') message = draft?.trim() ? 'Đã lưu trên máy.' : 'Đã xóa memo.';

  return (
    <section className="stack roadmap-review" aria-labelledby="lesson-memo-title">
      <h2 className="h-sec" id="lesson-memo-title" tabIndex={-1}>{title}</h2>
      {prompt && <p className="hint" id="memo-prompt">{prompt}</p>}
      <textarea id="lesson-memo" aria-labelledby="lesson-memo-title" aria-describedby={prompt ? 'memo-prompt memo-state' : 'memo-state'}
        placeholder="Điều cần nhớ hoặc cách mình sẽ áp dụng…" disabled={notes == null} value={value}
        onFocus={(event) => { setDraft(event.currentTarget.value); setFocused(true); }}
        onBlur={() => setFocused(false)} onChange={(event) => void save(event.target.value)} />
      <span className="hint" id="memo-state" role={state === 'error' ? 'alert' : undefined}>{message}</span>
      {state === 'error' && <div><button className="btn ghost" type="button" onClick={() => void save(value)}>Thử lưu lại</button></div>}
    </section>
  );
}
