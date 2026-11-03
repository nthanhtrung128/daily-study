import { baiLabel } from '../../modules/tr/data';
import { ConceptKv } from '../../modules/tr/cards/TrCard';
import { topicLabel, type LookupEntry } from '../../modules/lookup';

/** Nội dung chi tiết của một mục tra cứu (mở ra từ danh sách). */
export function LookupDetail({ e }: { e: LookupEntry }) {
  const d = e.detail;
  const where = e.bai.length ? <div className="hint">{baiLabel(e.bai)}</div> : null;
  switch (d.kind) {
    case 'concept':
      return (
        <>
          <ConceptKv c={d.c} />
          {where}
        </>
      );
    case 'formula':
      return (
        <>
          <div className="formula">{d.f.f}</div>
          {d.f.ex && <div className="hint">Ví dụ: {d.f.ex}</div>}
          {where}
        </>
      );
    case 'term':
      return (
        <>
          <div>{d.g.vi}</div>
          {d.g.note && <div className="hint">Đối chiếu khóa học: {d.g.note}</div>}
        </>
      );
    case 'open':
      return (
        <>
          {d.o.grp && <div className="hint">{d.o.grp}</div>}
          {d.o.hint ? <div>Gợi ý: {d.o.hint}</div> : <div className="hint">Không có đáp án cố định — tự đối chiếu với thực tế công ty bạn.</div>}
          {where}
        </>
      );
    case 'quiz':
      return (
        <>
          <ol className="lk-opts" type="A">
            {d.q.o.map((o, i) => (
              <li key={i} className={i === d.q.a ? 'ok' : undefined}>
                {o}
                {i === d.q.a && <b> ✓</b>}
              </li>
            ))}
          </ol>
          {d.q.ex && <div className="hint">{d.q.ex}</div>}
          {where}
        </>
      );
    case 'phrase':
      return (
        <>
          <div>
            <b lang="en">{d.p.en}</b> — {d.p.vi}
          </div>
          {d.p.example && (
            <div className="lk-ex" lang="en">
              {d.p.example}
            </div>
          )}
          {d.p.note && <div className="hint">{d.p.note}</div>}
          <div className="hint">
            {topicLabel(d.p.topic)} · {d.p.level}
          </div>
        </>
      );
    case 'pattern':
      return (
        <>
          <div className="hint">{d.p.situation}</div>
          <div className="lk-ex" lang="en">
            {d.p.en}
          </div>
          <div>{d.p.vi}</div>
          {d.p.slots?.map((s, i) => (
            <div key={i} className="hint">
              Thay “<span lang="en">{s.text}</span>” bằng: <span lang="en">{s.alts.join(' · ')}</span>
            </div>
          ))}
          {d.p.note && <div className="hint">{d.p.note}</div>}
          <div className="hint">
            {topicLabel(d.p.topic)} · {d.p.level}
          </div>
        </>
      );
  }
}
