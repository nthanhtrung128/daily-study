import { useState } from 'react';
import { loadTheme, saveTheme, type Theme } from '../../core/theme';
import { BackupPanel } from '../components/BackupPanel';
import { Placeholder } from '../components/Placeholder';

const THEME_LABELS: Record<Theme, string> = { auto: 'Theo máy', light: 'Sáng', dark: 'Tối' };

export function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(loadTheme);

  const choose = (t: Theme) => {
    setTheme(t);
    saveTheme(t);
  };

  return (
    <section className="stack" aria-labelledby="h-settings">
      <div className="panel stack">
        <h1 id="h-settings" className="h-page">
          Cài đặt
        </h1>
        <div>
          <div className="eyebrow" id="lbl-theme" style={{ marginBottom: 8 }}>
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
        <Placeholder session="S8">
          Thời lượng phiên, tỉ lệ TR / tiếng Anh, giọng đọc và tốc độ, file nhắc lịch .ics.
        </Placeholder>
      </div>

      <div className="panel stack">
        <div className="eyebrow">Dữ liệu</div>
        <p className="hint" style={{ margin: 0 }}>
          Tiến độ và ghi âm chỉ lưu trên máy này (IndexedDB). App không gửi dữ liệu đi đâu và chạy được khi không có mạng.
        </p>
        <p className="hint num" style={{ margin: 0 }}>
          Phiên bản {__APP_VERSION__}
        </p>
        <BackupPanel />
      </div>
    </section>
  );
}
