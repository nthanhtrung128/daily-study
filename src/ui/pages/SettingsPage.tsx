import { useState } from 'react';
import { loadTheme, saveTheme, type Theme } from '../../core/theme';
import { ICS_FILENAME, appUrl, buildIcs } from '../../core/ics';
import { DAILY_DURATIONS, DAY_SHORT_VI, MAX_NEW_CHOICES, WEEK_ORDER, isTime, shareLabel } from '../../core/prefs';
import { BackupPanel } from '../components/BackupPanel';
import { setDailyPrefs, useDailyPrefs } from '../useDailyPrefs';
import { useProgress } from '../useProgress';
import { downloadText } from '../mix/download';
import { ACCENTS, RATES } from '../../modules/english/tts';
import { setTtsPrefs, useTtsPrefs } from '../../modules/english/useTts';
import { SpeakButton } from '../../modules/english/ui/SpeakButton';
import '../mix/mix.css';

const THEME_LABELS: Record<Theme, string> = { auto: 'Theo máy', light: 'Sáng', dark: 'Tối' };
const SAMPLE = 'Could we go through the salary review timeline together?';
const DAY_LONG_VI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const rateLabel = (r: number) => `${String(r).replace('.', ',')}×`;

export function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const prefs = useDailyPrefs();
  const tp = useTtsPrefs();
  const p = useProgress();
  const [icsMsg, setIcsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const choose = (t: Theme) => {
    setTheme(t);
    saveTheme(t);
  };

  const toggleDay = (d: number) =>
    setDailyPrefs({ remindDays: prefs.remindDays.includes(d) ? prefs.remindDays.filter((x) => x !== d) : [...prefs.remindDays, d] });

  const makeIcs = () => {
    try {
      const url = appUrl(window.location);
      const ics = buildIcs({
        time: prefs.remindAt,
        days: prefs.remindDays,
        from: p.today(),
        now: new Date(),
        minutes: prefs.min,
        ...(url ? { url } : {}),
      });
      downloadText(ICS_FILENAME, ics, 'text/calendar;charset=utf-8');
      setIcsMsg({ ok: true, text: `Đã tạo ${ICS_FILENAME}: nhắc lúc ${prefs.remindAt}, ${prefs.remindDays.length === 7 ? 'mọi ngày' : prefs.remindDays.map((d) => DAY_SHORT_VI[d]).join(', ')}.` });
    } catch (e) {
      setIcsMsg({ ok: false, text: e instanceof Error ? e.message : 'Không tạo được file.' });
    }
  };

  return (
    <section className="stack settings" aria-labelledby="h-settings">
      <div className="panel stack">
        <h1 id="h-settings" className="h-page">
          Cài đặt
        </h1>
        <div className="set-group">
          <div className="eyebrow" id="lbl-theme">
            Giao diện
          </div>
          <div className="row" role="group" aria-labelledby="lbl-theme">
            {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={theme === t} onClick={() => choose(t)}>
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel stack" aria-labelledby="h-set-daily">
        <h2 id="h-set-daily" className="h-page">
          Phiên hằng ngày
        </h2>
        <div className="set-group">
          <div className="eyebrow" id="lbl-min">
            Thời lượng mặc định
          </div>
          <div className="row" role="group" aria-labelledby="lbl-min">
            {DAILY_DURATIONS.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={prefs.min === m} onClick={() => setDailyPrefs({ min: m })}>
                {`${m} phút`}
              </button>
            ))}
          </div>
        </div>
        <div className="set-group">
          <label className="eyebrow" htmlFor="set-share">
            Tỉ lệ thời gian TR / tiếng Anh
          </label>
          <div className="share-row">
            <span>TR</span>
            <input
              id="set-share"
              className="share"
              type="range"
              min={0}
              max={100}
              step={10}
              value={Math.round(prefs.trShare * 100)}
              aria-valuetext={shareLabel(prefs.trShare)}
              onChange={(e) => setDailyPrefs({ trShare: Number(e.target.value) / 100 })}
            />
            <span>EN</span>
          </div>
          <p className="hint share-val num" data-testid="share-val" aria-live="polite">
            {shareLabel(prefs.trShare)}
          </p>
          {prefs.trShare !== 0.4 && (
            <div>
              <button type="button" className="btn ghost small" onClick={() => setDailyPrefs({ trShare: 0.4 })}>
                Về mặc định 40 / 60
              </button>
            </div>
          )}
        </div>
        <div className="set-group">
          <div className="eyebrow" id="lbl-new">
            Số mục mới tối đa mỗi ngày
          </div>
          <div className="row" role="group" aria-labelledby="lbl-new">
            {MAX_NEW_CHOICES.map((n) => (
              <button key={n} type="button" className="chip num" aria-pressed={prefs.maxNew === n} onClick={() => setDailyPrefs({ maxNew: n })}>
                {String(n)}
              </button>
            ))}
          </div>
          <p className="hint">Tính chung TR và tiếng Anh. Chọn 0 để chỉ ôn mục đến hạn và câu từng sai.</p>
        </div>
        <div className="set-group">
          <div className="eyebrow">Luyện nói trong phiên</div>
          <div className="row">
            <button type="button" className="chip" aria-pressed={prefs.speak} onClick={() => setDailyPrefs({ speak: !prefs.speak })}>
              Kèm 1 bài luyện nói
            </button>
          </div>
          <p className="hint">Phiên 10–14 phút: 1 câu nói có chấm; từ 15 phút: 1 đề nói 1 phút có ghi âm. Micro chỉ bật khi bạn bấm.</p>
        </div>
      </div>

      <div className="panel stack" aria-labelledby="h-set-voice">
        <h2 id="h-set-voice" className="h-page">
          Giọng đọc tiếng Anh
        </h2>
        <div className="row" role="group" aria-label="Giọng đọc">
          {ACCENTS.map((a) => (
            <button key={a.id} type="button" className="chip" aria-pressed={tp.accent === a.id} onClick={() => setTtsPrefs({ accent: a.id })}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="row" role="group" aria-label="Tốc độ đọc">
          {RATES.map((r) => (
            <button key={r} type="button" className="chip num" aria-pressed={tp.rate === r} onClick={() => setTtsPrefs({ rate: r })}>
              {rateLabel(r)}
            </button>
          ))}
        </div>
        <div className="row">
          <SpeakButton text={SAMPLE} label="Nghe thử" />
        </div>
        <p className="hint">Dùng giọng có sẵn trên máy (miễn phí, chạy offline). Trên iPhone có thể tải giọng “Nâng cao” trong Cài đặt → Trợ năng → Nội dung được đọc.</p>
      </div>

      <div className="panel stack" aria-labelledby="h-set-remind">
        <h2 id="h-set-remind" className="h-page">
          Nhắc lịch
        </h2>
        <div className="set-group">
          <label className="eyebrow" htmlFor="set-time">
            Giờ nhắc
          </label>
          <div className="row">
            <input
              id="set-time"
              className="remind-time num"
              type="time"
              value={prefs.remindAt}
              onChange={(e) => {
                if (isTime(e.target.value)) setDailyPrefs({ remindAt: e.target.value });
              }}
            />
          </div>
        </div>
        <div className="set-group">
          <div className="eyebrow" id="lbl-days">
            Ngày nhắc
          </div>
          <div className="days" role="group" aria-labelledby="lbl-days">
            {WEEK_ORDER.map((d) => (
              <button key={d} type="button" className="chip" aria-pressed={prefs.remindDays.includes(d)} aria-label={DAY_LONG_VI[d]} onClick={() => toggleDay(d)}>
                {DAY_SHORT_VI[d]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <button type="button" className="btn" disabled={!prefs.remindDays.length} onClick={makeIcs}>
            Tải file nhắc lịch (.ics)
          </button>
        </div>
        {icsMsg && (
          <p className={`hint ${icsMsg.ok ? 'set-ok' : 'set-err'}`} role="status" data-testid="ics-msg">
            {icsMsg.text}
          </p>
        )}
        <p className="hint">
          Trên iPhone: mở file vừa tải → “Thêm tất cả” vào Lịch. Lịch sẽ nhắc đúng giờ (giờ Việt Nam) vào các ngày đã chọn. Đổi giờ thì tải lại file;
          sự kiện cũ có thể cần xóa tay trong Lịch.
        </p>
      </div>

      <div className="panel stack">
        <div className="eyebrow">Dữ liệu</div>
        <p className="hint" style={{ margin: 0 }}>
          Tiến độ, cài đặt và ghi âm chỉ lưu trên máy này (IndexedDB). App không gửi dữ liệu đi đâu và chạy được khi không có mạng.
        </p>
        <p className="hint num" style={{ margin: 0 }}>
          Phiên bản {__APP_VERSION__}
        </p>
        <BackupPanel />
      </div>
    </section>
  );
}
