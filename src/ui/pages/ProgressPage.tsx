import { getSetting, setSetting } from '../../core/db';
import { LEVEL_NAME, levelOf } from '../../core/leitner';
import { fmt } from '../../core/num';
import { CALC } from '../../modules/tr/calc';
import { DATA, BAI_SHORT } from '../../modules/tr/data';
import { ITEM_BY_ID, trId } from '../../modules/tr/items';
import { ROADMAP_MODULES, useRoadmapProgress } from '../../modules/tr/roadmap';
import { DEFAULT_PREFS, type Prefs } from '../../modules/tr/plan';
import { entryById, titleOfId } from '../../modules/lookup';
import { baiRows, extraRows, hardest, heatCells, learnedCount, totals, type BarRow } from '../../modules/progress/stats';
import { useProgress } from '../useProgress';
import { useDailyPrefs } from '../useDailyPrefs';
import { WeekPanel } from '../components/WeekPanel';
import { topMissed } from '../../core/misswords';
import { SpeakButton } from '../../modules/english/ui/SpeakButton';
import { useMissWords } from '../useMissWords';

const EXTRA_LABEL: Record<string, string> = { term: 'Thuật ngữ TR', phrase: 'Cụm từ EN', pattern: 'Câu mẫu EN' };
const baiName = (k: string) => (k === 'Bổ sung' ? 'Pháp lý VN' : `Buổi ${BAI_SHORT[k] ?? k}`);
const vnDay = (d: string) => d.split('-').reverse().join('/');

function Bars({ rows, label }: { rows: BarRow[]; label: (k: string) => string }) {
  return (
    <div className="prog-rows">
      {rows.map((r) => (
        <div key={r.key} className="prog-row">
          <span className="prog-name" title={DATA.meta.bai[r.key] ?? label(r.key)}>
            {label(r.key)}
          </span>
          <div className="stackbar" role="img" aria-label={`${label(r.key)}: ${r.l2} đã thuộc, ${r.l1} đang học trên ${r.n}`}>
            <i className="s2" style={{ width: `${r.n ? (r.l2 / r.n) * 100 : 0}%` }} />
            <i className="s1" style={{ width: `${r.n ? (r.l1 / r.n) * 100 : 0}%` }} />
          </div>
          <span className="num prog-n">
            {r.l2}/{r.n}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProgressPage() {
  const p = useProgress();
  const completedLessons = useRoadmapProgress();
  const today = p.today();
  const tot = totals(p.allDays());
  const learned = learnedCount(p.entries());
  const daily = useDailyPrefs();
  const streak = p.streak(daily.restDays);
  const heat = heatCells((d) => p.dayStat(d).n, today);
  const missed = topMissed(useMissWords(), 10);
  const hard = hardest(p.entries(), (id) => ITEM_BY_ID.has(id) || !!entryById(id));

  const reviewNow = async () => {
    try {
      const prefs = await getSetting<Prefs>('tr.prefs', DEFAULT_PREFS);
      await setSetting('tr.prefs', { ...DEFAULT_PREFS, ...prefs, mode: 'review' });
    } catch {
      /* IndexedDB lỗi: vẫn chuyển trang */
    }
    window.location.hash = '#hom-nay';
  };

  return (
    <section className="stack" aria-labelledby="h-progress">
      <div className="panel stack">
        <h1 id="h-progress" className="h-page">
          Tiến độ
        </h1>
        <div className="stats">
          <div className="stat">
            <b className="num" data-testid="pg-streak">{streak}</b>
            <span>ngày liên tiếp</span>
          </div>
          <div className="stat">
            <b className="num" data-testid="pg-learned">{learned}</b>
            <span>mục đã thuộc</span>
          </div>
          <div className="stat">
            <b className="num" data-testid="pg-reviews">{fmt(tot.n)}</b>
            <span>lượt ôn</span>
          </div>
        </div>
      </div>

      <WeekPanel p={p} goalMin={daily.goalMin} />

      <section className="panel stack" aria-labelledby="reading-progress">
        <h2 id="reading-progress" className="h-sec">Bài đọc theo mô-đun</h2>
        {completedLessons ? ROADMAP_MODULES.map(({ code, title, lessons }) => {
          const count = lessons.filter((lesson) => completedLessons.includes(lesson.id)).length;
          return (
            <div className="reading-progress-row" key={code}>
              <h3 className="h-sec" id={`reading-${code}`}>{code} · {title}</h3>
              <progress aria-labelledby={`reading-${code}`} value={count} max={lessons.length} />
              <p className="hint">{count}/{lessons.length} bài đã đánh dấu hoàn thành</p>
            </div>
          );
        }) : <p className="hint">Chưa có dữ liệu tiến độ từ bộ nhớ máy.</p>}
      </section>

      <div className="panel stack">
        <h2 className="h-sec">Tiến độ theo buổi</h2>
        <div className="legend">
          <span>
            <i style={{ background: 'var(--good)' }} />
            Đã thuộc
          </span>
          <span>
            <i style={{ background: 'var(--warn)' }} />
            Đang học
          </span>
          <span>
            <i style={{ background: 'var(--sunk)' }} />
            Chưa học
          </span>
        </div>
        <Bars rows={baiRows(p.stateOf)} label={baiName} />
        <div className="eyebrow">Thuật ngữ và tiếng Anh</div>
        <Bars rows={extraRows(p.stateOf)} label={(k) => EXTRA_LABEL[k] ?? k} />
      </div>

      <div className="panel stack">
        <h2 className="h-sec">Nhịp ôn 35 ngày</h2>
        <div className="heat" role="img" aria-label={`35 ngày gần nhất: ${heat.filter((c) => c.n > 0).length} ngày có ôn`}>
          {heat.map((c) => (
            <i key={c.day} className={`${c.lv ? `h${c.lv}` : ''}${c.day === today ? ' today' : ''}`} title={`${vnDay(c.day)}: ${c.n} mục`} />
          ))}
        </div>
        <div className="legend">
          <span>Ít</span>
          <span className="heat-scale" aria-hidden="true">
            <i />
            <i className="h1" />
            <i className="h2" />
            <i className="h3" />
          </span>
          <span>Nhiều (≥ 30 mục/ngày)</span>
        </div>
        <p className="hint">
          Tổng {fmt(tot.n)} lượt ôn · {fmt(Math.round(tot.s / 60))} phút · {tot.active} ngày có ôn · chuỗi hiện tại {streak} ngày.
        </p>
      </div>

      <div className="panel stack">
        <h2 className="h-sec">Hay quên / sai nhất</h2>
        {hard.length ? (
          <>
            <div className="tbl-wrap">
              <table className="tbl" data-testid="hard-list">
                <thead>
                  <tr>
                    <th>Mục</th>
                    <th className="n">Lần sai</th>
                  </tr>
                </thead>
                <tbody>
                  {hard.map(([id, s]) => (
                    <tr key={id}>
                      <td>{titleOfId(id)}</td>
                      <td className="n num">{s.wrong}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <button type="button" className="btn small" onClick={() => void reviewNow()}>
                Ôn ngay các mục này
              </button>
            </div>
          </>
        ) : (
          <p className="hint">Chưa có mục nào sai. Làm vài phiên trắc nghiệm hoặc bài tính để danh sách này có dữ liệu.</p>
        )}
      </div>

      <div className="panel stack">
        <h2 className="h-sec">Từ hay sai</h2>
        {missed.length ? (
          <>
            <ul className="miss-list" data-testid="miss-list">
              {missed.map((m) => (
                <li key={m.word}>
                  <b lang="en">{m.word}</b>
                  <span className="tag num">{`×${m.n}`}</span>
                  <SpeakButton text={m.word} what={m.word} />
                </li>
              ))}
            </ul>
            <p className="hint">Từ tiếng Anh bạn nói hoặc nghe chép sai nhiều nhất. Luyện lại trong “Ôn điểm yếu” ở trang Hôm nay; nói / chép đúng thì số lần giảm.</p>
          </>
        ) : (
          <p className="hint">Chưa có từ nào. Danh sách có dữ liệu sau khi bạn luyện nói có chấm hoặc nghe chép.</p>
        )}
      </div>

      <div className="panel stack">
        <h2 className="h-sec">Bài tính</h2>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Dạng</th>
                <th className="n">Lần sai</th>
                <th>Mức</th>
              </tr>
            </thead>
            <tbody>
              {CALC.map((c) => {
                const s = p.stateOf(trId(c.id));
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="n num">{s?.wrong ?? 0}</td>
                    <td className="nw">{s ? LEVEL_NAME[levelOf(s)] : 'Chưa làm'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="hint">
        Lịch ôn theo hộp Leitner: nhớ rõ thì giãn 1 → 3 → 7 → 14 → 30 ngày; quên hoặc sai thì quay về hộp 1 và ôn lại ngay phiên sau.
      </p>
      <div className="row">
        <a className="btn ghost link-btn" href="#cai-dat">
          Sao lưu tiến độ (Cài đặt → Dữ liệu)
        </a>
      </div>
    </section>
  );
}
