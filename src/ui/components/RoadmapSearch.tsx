import { useRef } from 'react';
import { searchRoadmap } from '../../modules/tr/roadmapSearch';
import { lessonHref } from '../routes';

export function RoadmapSearch({ query, onQuery, completed, onOpen }: {
  query: string;
  onQuery: (query: string) => void;
  completed: readonly string[] | undefined;
  onOpen: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const results = searchRoadmap(query);
  return (
    <section className="panel stack" aria-labelledby="lesson-search-label">
      <label className="field">
        <strong id="lesson-search-label">Tìm bài trong lộ trình</strong>
        <input type="search" ref={input} value={query} placeholder="Ví dụ: ma trận merit, M05.2"
          onChange={(event) => onQuery(event.target.value)} />
      </label>
      {query.trim() && <>
        <div className="row">
          <p className="hint" role="status">{results.length ? `${results.length} bài phù hợp` : 'Không tìm thấy bài phù hợp.'}</p>
          <button className="btn ghost small" type="button" onClick={() => { onQuery(''); input.current?.focus(); }}>
            Xóa tìm kiếm
          </button>
        </div>
        {results.length > 0 && <ul className="reading-results" role="list" aria-label="Kết quả tìm bài">
          {results.map(({ code, module, lesson }) => (
            <li key={lesson.id}>
              <span className="eyebrow">{code} · {module}</span>
              <a className="reading-result-link" id={`result-${lesson.id}`} href={lessonHref(lesson.id)}
                onClick={() => onOpen(lesson.id)}>{lesson.title}</a>
              {completed?.includes(lesson.id) && <span className="hint">Đã hoàn thành</span>}
            </li>
          ))}
        </ul>}
      </>}
    </section>
  );
}
