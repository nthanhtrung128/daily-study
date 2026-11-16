import { fmt } from '../../core/num';
import { goalMet, studySecs, weekDays, weekStart, weekdayOf } from '../../core/studytime';
import type { Progress } from '../../core/progress';
import type { DailyPrefs } from '../../core/prefs';

/** Mục tiêu phút học hôm nay: thanh kiểu dải lương (0 → mục tiêu), trạng thái đạt, số ngày đạt trong tuần. */
export function GoalBar({ p, prefs }: { p: Progress; prefs: Pick<DailyPrefs, 'goalMin' | 'restDays'> }) {
  const today = p.today();
  const goal = prefs.goalMin;
  const secs = studySecs(p.dayStat(today));
  const done = secs >= goal * 60;
  const min = Math.floor(secs / 60);
  const pct = `${(Math.min(1, secs / (goal * 60)) * 100).toFixed(1)}%`;
  const metDays = weekDays(weekStart(today)).filter((d) => goalMet(p.dayStat(d), goal)).length;
  const rest = prefs.restDays.includes(weekdayOf(today));
  return (
    <div className={`panel stack goal${done ? ' done' : ''}`} data-testid="goal" data-done={done}>
      <div className="goal-head">
        <div>
          <div className="eyebrow">Mục tiêu hôm nay</div>
          <div className="goal-num">
            <b className="num" data-testid="goal-min">
              {fmt(min)}
            </b>
            <span className="num">/{goal} phút</span>
          </div>
        </div>
        {done && (
          <span className="goal-badge" data-testid="goal-done">
            <span aria-hidden="true">✓ </span>Đã đạt mục tiêu
          </span>
        )}
      </div>
      <div
        className="range goal-range"
        role="progressbar"
        aria-label={`Mục tiêu hôm nay: ${min} trên ${goal} phút${done ? ', đã đạt' : ''}`}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(goal, min)}
      >
        <div className="track">
          <div className="fill" style={{ width: pct }} />
        </div>
        <i className="tick" style={{ left: '50%' }} />
        <i className="mark" style={{ left: pct }} />
      </div>
      <p className="hint" data-testid="goal-week">
        Tuần này: <b className="num">{metDays}</b>/7 ngày đạt mục tiêu
        {rest ? ' · hôm nay là ngày nghỉ, không ôn cũng không đứt chuỗi.' : done ? ' · hẹn bạn ngày mai.' : '.'}
      </p>
    </div>
  );
}
