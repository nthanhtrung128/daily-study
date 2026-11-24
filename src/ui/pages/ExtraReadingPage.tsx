import { useEffect, useRef, useState } from 'react';
import { ReadingRecall, type RecallCase } from './ReadingRecall';
import recall from '../../../content/reading/recall.json';
import { ReadingConversation } from './ReadingConversation';
import articles from '../../../content/reading/articles.json';
import { allReadings, findReadings, keepReadingFilters, readReadingFilters, readingRegions, type ReadingFilters } from '../../modules/english/readingSearch';
import { workHref } from '../../modules/english/workTopics';
import { lessonHref } from '../routes';
import { useLocationHash } from '../useHashRoute';
import { useFocusOnMount } from '../useFocusOnMount';

type Article = typeof articles[number];
const practice: Readonly<Record<string, { lesson: string; tasks: readonly RecallCase[] }>> = recall;
type Language = 'en' | 'vi';
const languageNames = { en: 'English', vi: 'Tiếng Việt' };

export function ExtraReadingPage() {
  const hash = useLocationHash();
  const params = new URLSearchParams(hash.split('?')[1]);
  const id = params.get('bai');
  const variant = params.get('tu-nho');
  const article = articles.find((item) => item.id === id);
  const [filters, setFilters] = useState(readReadingFilters);
  const search = useRef<HTMLInputElement>(null);
  const count = useRef<HTMLParagraphElement>(null);
  const [language, setLanguage] = useState<Language>('en');
  const previous = useRef<string | null>(null);
  const heading = useFocusOnMount<HTMLHeadingElement>(!article);
  useEffect(() => {
    if (article) {
      previous.current = article.id;
      window.scrollTo(0, 0);
    } else if (previous.current) {
      const link = document.getElementById('doc-' + previous.current);
      link?.focus({ preventScroll: true });
      link?.scrollIntoView({ block: 'center' });
      previous.current = null;
    }
  }, [article, variant]);

  if (article && (variant === '1' || variant === '2')) {
    const index = Number(variant) - 1;
    const exercise = practice[article.id];
    const task = exercise?.tasks[index];
    if (exercise && task) return <ReadingRecall key={hash} lessonId={exercise.lesson} title={article.title} id={article.id} task={task} index={index} language={language} />;
  }
  if (article) return <Reader key={article.id} article={article} language={language} onLanguage={setLanguage} />;
  function changeFilters(next: ReadingFilters) {
    setFilters(next);
    keepReadingFilters(next);
  }
  const visible = findReadings(filters);
  const filtered = !!filters.query || filters.region !== allReadings.region;
  return (
    <section className="panel stack" aria-labelledby="extra-title">
      <h1 className="h-page" ref={heading} id="extra-title" tabIndex={-1}>Đọc thêm</h1>
      <form role="search" aria-label="Tìm trong thư viện bài đọc" className="stack"
        onSubmit={event => { event.preventDefault(); count.current?.focus(); }}>
        <label className="field">
          <strong>Tìm bài đọc bằng tiếng Anh hoặc tiếng Việt</strong>
          <input type="search" ref={search} enterKeyHint="search" placeholder="Ví dụ: phụ cấp ca, handover"
            value={filters.query} onChange={event => changeFilters({ ...filters, query: event.target.value })} />
        </label>
        <div className="row" role="group" aria-label="Lọc theo nguồn">
          {readingRegions.map(name => <button key={name} type="button" className="chip" aria-pressed={filters.region === name}
            onClick={() => changeFilters({ ...filters, region: name })}>{name}</button>)}
        </div>
      </form>
      <div className="row">
        <p className="hint" role="status" ref={count} tabIndex={-1}>{visible.length
          ? `${visible.length} bài đọc` : 'Không tìm thấy bài đọc. Thử từ khác hoặc đặt lại bộ lọc.'}</p>
        {filtered && <button type="button" className="btn ghost small" onClick={() => {
          changeFilters(allReadings); search.current?.focus();
        }}>Đặt lại bộ lọc</button>}
      </div>
      <ul className="reading-results" aria-label="Danh sách bài đọc" role="list">
        {visible.map((item) => (
          <li key={item.id}>
            <span className="eyebrow">{item.region} · {item.source.publisher}</span>
            <a className="reading-result-link article-titles" id={'doc-' + item.id} href={'#doc-them?bai=' + item.id}>
              <span lang="en">{item.title.en}</span>
              <span lang="vi">{item.title.vi}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Reader({ article, language, onLanguage }: {
  article: Article; language: Language; onLanguage: (value: Language) => void;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const other = language === 'en' ? 'vi' : 'en';
  const lesson = practice[article.id]?.lesson;
  return (
    <article className="panel stack roadmap-reader extra-reader" aria-labelledby="extra-article">
      <div><a className="btn ghost roadmap-link" href="#doc-them">Về Đọc thêm</a></div>
      <header>
        <p className="eyebrow">{article.region} · {article.source.publisher}</p>
        <h1 className="h-page" id="extra-article" lang={language} tabIndex={-1} ref={heading}>{article.title[language]}</h1>
      </header>
      <div className="row" role="group" aria-label="Ngôn ngữ bài đọc">
        {(['en', 'vi'] as const).map((code) => <button key={code} lang={code} type="button" className="chip"
          aria-pressed={language === code} onClick={() => onLanguage(code)}>{languageNames[code]}</button>)}
      </div>
      {article.weeklyFollowUp && <div><a className="btn roadmap-link" href={workHref(article.id)}>
        Chọn luyện trong tuần · 2 phút
      </a></div>}
      {practice[article.id] && <div className="row"><a className="btn ghost roadmap-link" href={'#doc-them?bai=' + article.id + '&tu-nho=1'}>Gấp bài và tự thử</a></div>}
      <div className="stack passages" key={language}>
        {article.paragraphs.map((pair, index) => (
          <div key={index}>
            <p lang={language}>{pair[language]}</p>
            <details>
              <summary>{language === 'en' ? 'Dịch đoạn' : 'Xem tiếng Anh đoạn'} {index + 1}</summary>
              <p lang={other}>{pair[other]}</p>
            </details>
          </div>
        ))}
      </div>
      <section className="stack" aria-label="Cụm từ trong bài">
        <h2 className="h-sec">Cụm từ trong bài</h2>
        <dl className="word-pairs">
          {article.terms.map((term) => <div key={term.en}><dt lang="en">{term.en}</dt><dd>{term.vi}</dd></div>)}
        </dl>
      </section>
      <section className="roadmap-review stack" aria-label="Tự kiểm tra">
        <h2 className="h-sec">Tự kiểm tra</h2>
        <p lang={language}>{article.question[language]}</p>
        <details><summary>Xem đáp án</summary><p lang={language}>{article.answer[language]}</p></details>
      </section>
      {article.turns && <ReadingConversation turns={article.turns} />}
      {lesson && <a className="btn ghost roadmap-link" href={lessonHref(lesson)}>Mở bài liên quan trong lộ trình Total Rewards</a>}
      <footer className="stack">
        <h2 className="h-sec">Nguồn tham khảo</h2>
        <p className="hint">Tình huống và bản dịch do Daily Study biên soạn. {article.source.reason}</p>
        <a className="reading-result-link" href={article.source.url} target="_blank" rel="noopener noreferrer">{article.source.publisher} · {article.source.name}</a>
      </footer>
    </article>
  );
}
