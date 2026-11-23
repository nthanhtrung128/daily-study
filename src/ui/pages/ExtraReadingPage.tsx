import { useEffect, useRef, useState } from 'react';
import { ReadingConversation } from './ReadingConversation';
import articles from '../../../content/reading/articles.json';
import { useLocationHash } from '../useHashRoute';
import { useFocusOnMount } from '../useFocusOnMount';

type Article = typeof articles[number];
type Language = 'en' | 'vi';
const languageNames = { en: 'English', vi: 'Tiếng Việt' };
const regions = ['Tất cả', 'Việt Nam', 'Quốc tế'];

export function ExtraReadingPage() {
  const hash = useLocationHash();
  const id = new URLSearchParams(hash.split('?')[1]).get('bai');
  const article = articles.find((item) => item.id === id);
  const [region, setRegion] = useState('Tất cả');
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
  }, [article]);

  if (article) return <Reader key={article.id} article={article} language={language} onLanguage={setLanguage} />;
  const visible = articles.filter((item) => region === 'Tất cả' || item.region === region);
  return (
    <section className="panel stack" aria-labelledby="extra-title">
      <header className="stack">
        <h1 className="h-page" ref={heading} id="extra-title" tabIndex={-1}>Đọc thêm</h1>
        <p>Luyện đọc tiếng Anh qua tình huống công sở và đãi ngộ. Mỗi bài có bản tiếng Việt để đối chiếu.</p>
      </header>
      <div className="row" role="group" aria-label="Lọc theo nguồn">
        {regions.map((name) => <button key={name} type="button" className="chip" aria-pressed={region === name}
          onClick={() => setRegion(name)}>{name}</button>)}
      </div>
      <p className="hint" role="status">{visible.length} bài đọc</p>
      <ul className="reading-results" aria-label="Danh sách bài đọc" role="list">
        {visible.map((item) => (
          <li key={item.id}>
            <span className="eyebrow">{item.region} · {item.source.publisher}</span>
            <a className="reading-result-link" id={'doc-' + item.id} href={'#doc-them?bai=' + item.id}>
              <span lang="en">{item.title.en}</span>
            </a>
            <p>{item.title.vi}</p>
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
      <footer className="stack">
        <h2 className="h-sec">Nguồn tham khảo</h2>
        <p className="hint">Tình huống và bản dịch do Daily Study biên soạn. {article.source.reason}</p>
        <a className="reading-result-link" href={article.source.url} target="_blank" rel="noopener noreferrer">{article.source.publisher} · {article.source.name}</a>
      </footer>
    </article>
  );
}
