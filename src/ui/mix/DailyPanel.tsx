import { DAILY_DURATIONS, shareLabel } from '../../core/prefs';
import { summarize, type DailyPlan } from '../../modules/mix/plan';
import { setDailyPrefs, useDailyPrefs } from '../useDailyPrefs';
import { useProgress } from '../useProgress';
import { planToday } from './planToday';
import './mix.css';

/** Khối chính trang Hôm nay: một nút "Bắt đầu ôn hôm nay" lập phiên trộn TR + tiếng Anh theo cài đặt. */
export function DailyPanel({ onStart }: { onStart: (plan: DailyPlan, minutes: number) => void }) {
  const p = useProgress();
  const prefs = useDailyPrefs();
  const plan = planToday(p, prefs);
  const s = summarize(plan);
  const newLeft = Math.max(0, prefs.maxNew - p.newToday());

  return (
    <div className="panel stack daily" aria-labelledby="daily-duration">
      <div>
        <div className="eyebrow">Phiên hằng ngày · {shareLabel(prefs.trShare)}</div>
        <h2 id="daily-duration" className="h-sec">
          Hôm nay ôn bao lâu?
        </h2>
      </div>
      <div className="row" role="group" aria-label="Thời lượng phiên hôm nay">
        {DAILY_DURATIONS.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={prefs.min === m} onClick={() => setDailyPrefs({ min: m })}>
            {`${m} phút`}
          </button>
        ))}
      </div>
      <div className="daily-sum" data-testid="daily-sum">
        {plan.entries.length ? (
          <>
            <span className="tag" data-lane="tr">{`${s.tr} mục TR`}</span>
            <span className="tag" data-lane="en">{`${s.en} mục tiếng Anh`}</span>
            {s.speak && <span className="tag" data-lane="speak">{s.speak === 'topic' ? '1 đề nói 1 phút' : '1 câu nói có chấm'}</span>}
            {s.dict > 0 && <span className="tag" data-lane="en">{`${s.dict} câu nghe chép`}</span>}
            <span className="tag num">{`≈ ${s.minutes} phút`}</span>
          </>
        ) : (
          <span className="hint">Hôm nay đã ôn hết mục đến hạn và đủ số mục mới. Có thể ôn riêng TR hoặc tiếng Anh bên dưới.</span>
        )}
      </div>
      <button type="button" className="btn daily-go" disabled={!plan.entries.length} onClick={() => onStart(plan, prefs.min)}>
        Bắt đầu ôn hôm nay
      </button>
      <p className="hint">
        Ưu tiên mục đến hạn, rồi câu từng sai, rồi mục mới (còn <span className="num">{newLeft}</span>/{prefs.maxNew} mục mới hôm nay). Đổi tỉ lệ,
        giới hạn mục mới, luyện nói trong tab Cài đặt.
      </p>
    </div>
  );
}
