import { fmt } from '../../core/num';
import { Explain } from '../../modules/tr/cards/TrCard';
import { SpeakButton } from '../../modules/english/ui/SpeakButton';
import { LANE_VI, tally, titleOfEntry, type DailyResult, type LaneTally } from '../../modules/mix/result';
import { useProgress } from '../useProgress';
import { useDailyPrefs } from '../useDailyPrefs';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const pct = (l: LaneTally) => (l.n ? `${fmt((l.ok / l.n) * 100)}%` : '–');

/** Màn kết quả phiên hằng ngày: đúng/sai theo TR/EN, bài nói, chuỗi ngày, mục cần ôn lại. */
export function DailyResultView({ results, secs, onMore, onHome }: { results: DailyResult[]; secs: number; onMore: () => void; onHome: () => void }) {
  const p = useProgress();
  const { restDays } = useDailyPrefs();
  const t = tally(results);
  const n = t.tr.n + t.en.n;
  const ok = t.tr.ok + t.en.ok;
  return (
    <section className="stack mix-result" aria-labelledby="h-mix-result">
      <div className="panel stack">
        <h1 id="h-mix-result" className="h-page">
          {n || t.speak.done ? 'Xong phiên hôm nay' : 'Phiên chưa có câu trả lời'}
        </h1>
        <div className="stats">
          <div className="stat">
            <b className="num" data-testid="mix-n">
              {n}
            </b>
            <span>mục đã ôn</span>
          </div>
          <div className="stat">
            <b className="num">{n ? `${fmt((ok / n) * 100)}%` : '–'}</b>
            <span>nhớ rõ / đúng</span>
          </div>
          <div className="stat">
            <b className="num">{mmss(secs)}</b>
            <span>thời gian</span>
          </div>
        </div>
        <table className="mix-table">
          <caption className="eyebrow">Theo phần</caption>
          <thead>
            <tr>
              <th scope="col">Phần</th>
              <th scope="col">Đã ôn</th>
              <th scope="col">Đúng</th>
              <th scope="col">Mơ hồ</th>
              <th scope="col">Sai</th>
            </tr>
          </thead>
          <tbody>
            {(['tr', 'en'] as const).map((lane) => (
              <tr key={lane} data-testid={`mix-row-${lane}`}>
                <th scope="row">{LANE_VI[lane]}</th>
                <td className="num">{t[lane].n}</td>
                <td className="num">
                  {t[lane].ok} <small>({pct(t[lane])})</small>
                </td>
                <td className="num">{t[lane].vague}</td>
                <td className="num">{t[lane].wrong}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {t.speak.done > 0 && (
          <p className="hint" data-testid="mix-speak">
            Luyện nói: đã làm {t.speak.done} bài{t.speak.score !== null ? ` · điểm ${fmt(t.speak.score)}%` : ''}. Nghe lại bản ghi ở Đề nói 1 phút.
          </p>
        )}
        <p className="hint">
          Chuỗi <b className="num">{p.streak(restDays)}</b> ngày ·{' '}
          {t.review.length
            ? `${t.review.length} mục quên / mơ hồ được xếp lịch ôn lại (quên: ngay phiên sau, mơ hồ: ngày mai).`
            : 'Không có mục nào sai. Các mục nhớ rõ được giãn lịch ôn.'}
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={onMore}>
            Ôn thêm 5 phút
          </button>
          <button type="button" className="btn ghost" onClick={onHome}>
            Về trang Hôm nay
          </button>
        </div>
      </div>
      {t.review.length > 0 && (
        <>
          <div className="eyebrow">Cần ôn lại</div>
          <div className="results">
            {t.review.map((r, k) => {
              const e = r.entry;
              return (
                <details key={k} className="item">
                  <summary>
                    <b {...(e.lane === 'en' ? { lang: 'en' } : {})}>{titleOfEntry(e)}</b>{' '}
                    <span className="tag">
                      {e.tier === 'extra' ? 'Nói' : e.lane === 'tr' ? 'TR' : 'EN'} · {r.g === 0 ? 'Quên' : 'Mơ hồ'}
                    </span>
                  </summary>
                  <div className="body">
                    {e.lane === 'tr' ? (
                      <Explain it={e.item} />
                    ) : e.tier === 'extra' ? (
                      e.item.kind === 'say' && (
                        <>
                          <div>{e.item.item.vi}</div>
                          <div className="row">
                            <SpeakButton text={e.item.item.en} label="Nghe" what={e.item.item.en} />
                          </div>
                        </>
                      )
                    ) : e.item.type === 'phrase' ? (
                      <>
                        <div>{e.item.ph.vi}</div>
                        <div className="hint" lang="en">
                          {e.item.ph.example}
                        </div>
                      </>
                    ) : (
                      <div>{e.item.pt.vi}</div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
