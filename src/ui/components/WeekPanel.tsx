import { useState } from 'react';
import { fmt } from '../../core/num';
import { DAY_SHORT_VI } from '../../core/prefs';
import type { Progress } from '../../core/progress';
import { weekStart, weekdayOf } from '../../core/studytime';
import { dayLongVi, delta, mins, nextWeek, prevWeek, weekLabel, weekSummary, type Delta } from '../../modules/progress/week';

function Diff({ d, unit = '' }: { d: Delta | null; unit?: string }) {
  if (!d) return null;
  if (d.dir === 'same') return <span className="wk-diff">= bằng tuần trước</span>;
  return (
    <span className="wk-diff" data-dir={d.dir}>
      <span aria-hidden="true">{d.dir === 'up' ? '↑' : '↓'} </span>
      <span className="sr-only">{d.dir === 'up' ? 'tăng' : 'giảm'} </span>
      <span className="num">
        {fmt(d.by)}
        {unit}
      </span>{' '}
      so với tuần trước
    </span>
  );
}

/** Tổng kết tuần (thứ Hai → Chủ nhật): số phút, ngày đạt mục tiêu, mục mới thuộc, tỉ lệ nhớ, điểm nói; so với tuần trước. */
export function WeekPanel({ p, goalMin }: { p: Progress; goalMin: number }) {
  const today = p.today();
  const thisWeek = weekStart(today);
  const [start, setStart] = useState(thisWeek);
  const w = weekSummary((d) => p.dayStat(d), start, goalMin);
  const pv = weekSummary((d) => p.dayStat(d), prevWeek(start), goalMin);
  const cmp = !pv.empty;
  const goalSecs = goalMin * 60;
  const top = Math.max(goalSecs, ...w.days.map((d) => d.secs));
  const pct = (v: number | null) => (v === null ? null : v * 100);
  const title = start === thisWeek ? 'Tuần này' : start === prevWeek(thisWeek) ? 'Tuần trước' : 'Tuần';
  const chartLabel = `Phút học từng ngày, mục tiêu ${goalMin} phút. ${w.days
    .map((d) => `${dayLongVi(d.day)}: ${mins(d.secs)} phút${d.met ? ', đạt mục tiêu' : ''}`)
    .join('; ')}.`;

  return (
    <div className="panel stack" aria-labelledby="h-week" data-testid="week">
      <div className="wk-head">
        <h2 id="h-week" className="h-sec">
          Tổng kết tuần
        </h2>
        <div className="wk-nav">
          <button type="button" className="btn ghost small" aria-label="Xem tuần trước đó" onClick={() => setStart(prevWeek(start))}>
            ‹ Trước
          </button>
          <button type="button" className="btn ghost small" aria-label="Xem tuần sau đó" disabled={start >= thisWeek} onClick={() => setStart(nextWeek(start))}>
            Sau ›
          </button>
        </div>
      </div>
      <p className="wk-range" aria-live="polite" data-testid="week-range">
        {title} · <span className="num">{weekLabel(start)}</span>
      </p>

      {w.empty ? (
        <p className="hint" data-testid="week-empty">
          {start === thisWeek
            ? 'Tuần này chưa có lượt ôn nào. Làm một phiên ở trang Hôm nay, số phút và biểu đồ sẽ hiện ở đây.'
            : 'Tuần này không có dữ liệu ôn.'}
        </p>
      ) : (
        <>
          <div className="wk-chart" role="img" aria-label={chartLabel} data-testid="week-chart">
            <i className="wk-goal" style={{ bottom: `${(goalSecs / top) * 100}%` }} />
            {w.days.map((d) => (
              <div key={d.day} className={`wk-col${d.met ? ' met' : ''}${d.day === today ? ' today' : ''}`} aria-hidden="true">
                <span className="wk-bar" style={{ height: `${(d.secs / top) * 100}%` }}>
                  {d.secs > 0 && <span className="wk-val num">{mins(d.secs)}</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="wk-days" aria-hidden="true">
            {w.days.map((d) => (
              <span key={d.day} className={d.day === today ? 'today' : ''}>
                {DAY_SHORT_VI[weekdayOf(d.day)]}
              </span>
            ))}
          </div>
          <div className="legend">
            <span>
              <i style={{ background: 'var(--good)' }} />
              Đạt mục tiêu
            </span>
            <span>
              <i style={{ background: 'var(--accent)' }} />
              Có học
            </span>
            <span>
              <i className="wk-goal-key" />
              Mục tiêu {goalMin} phút
            </span>
          </div>

          <div className="wk-stats">
            <div className="stat">
              <b className="num" data-testid="week-min">{fmt(mins(w.secs))}</b>
              <span>phút học</span>
              {cmp && <Diff d={delta(mins(w.secs), mins(pv.secs))} unit=" phút" />}
            </div>
            <div className="stat">
              <b className="num" data-testid="week-goal-days">
                {w.goalDays}/7
              </b>
              <span>ngày đạt mục tiêu · {w.activeDays} ngày có học</span>
              {cmp && <Diff d={delta(w.goalDays, pv.goalDays)} unit=" ngày" />}
            </div>
            <div className="stat">
              <b className="num" data-testid="week-mastered">{fmt(w.mastered)}</b>
              <span>mục mới thuộc</span>
              {cmp && <Diff d={delta(w.mastered, pv.mastered)} />}
            </div>
            <div className="stat">
              <b className="num" data-testid="week-reviews">{fmt(w.n)}</b>
              <span>lượt ôn{w.recall !== null ? ` · nhớ ${fmt(w.recall * 100)}%` : ''}</span>
              {cmp && <Diff d={delta(pct(w.recall), pct(pv.recall))} unit=" điểm %" />}
            </div>
            <div className="stat">
              <b className="num" data-testid="week-speak">{w.speakAvg === null ? '–' : `${fmt(w.speakAvg)}%`}</b>
              <span>{w.speakAvg === null ? 'chưa có điểm nói' : 'điểm nói trung bình'}</span>
              {cmp && <Diff d={delta(w.speakAvg, pv.speakAvg)} unit=" điểm" />}
            </div>
          </div>
          <p className="hint" data-testid="week-split">
            TR <span className="num">{fmt(mins(w.tr))}</span> phút · Tiếng Anh <span className="num">{fmt(mins(w.en))}</span> phút · Nói{' '}
            <span className="num">{fmt(mins(w.speak))}</span> phút.
            {w.secs > w.tr + w.en + w.speak ? ' Những ngày ghi trước bản cập nhật này chỉ có tổng phút, chưa tách nhóm.' : ''}
          </p>
        </>
      )}
    </div>
  );
}
