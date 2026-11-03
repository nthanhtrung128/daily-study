import { Placeholder } from '../components/Placeholder';

export function LookupPage() {
  return (
    <section className="stack" aria-labelledby="h-lookup">
      <div className="panel stack">
        <h1 id="h-lookup" className="h-page">
          Tra cứu
        </h1>
        <label className="field">
          <span className="eyebrow">Tìm khái niệm, thuật ngữ, công thức, cụm từ</span>
          <input type="search" placeholder="vd: compa-ratio, merit, midpoint…" disabled />
        </label>
        <Placeholder session="S3">Danh sách khái niệm, bảng thuật ngữ Anh–Việt và công thức TR101.</Placeholder>
      </div>
    </section>
  );
}
