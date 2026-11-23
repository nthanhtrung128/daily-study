import { useState } from 'react';
import { dayKey } from '../../core/date';
import { appUrl, buildIcs } from '../../core/ics';
import { DAY_SHORT_VI } from '../../core/prefs';
import { downloadText, isStandalone, shareFile } from '../mix/download';
import { useDailyPrefs } from '../useDailyPrefs';

export function LessonReminder({ id, title, prompt, href }: { id: string; title: string; prompt: string; href: string }) {
  const prefs = useDailyPrefs();
  const [message, setMessage] = useState('');
  async function exportLesson() {
    try {
      const url = appUrl(window.location, href);
      const calendar = buildIcs({ time: prefs.remindAt, days: prefs.remindDays, from: dayKey(), now: new Date(), minutes: 5,
        reminderId: id, summary: 'Tự ôn · ' + title, description: prompt, alarmText: prompt, ...(url ? { url } : {}) });
      const filename = 'on-' + id + '.ics';
      const mime = 'text/calendar;charset=utf-8';
      if (isStandalone()) {
        const shared = await shareFile(new File([calendar], filename, { type: 'text/calendar' }));
        if (shared === 'cancelled') { setMessage('Đã đóng bảng chia sẻ.'); return; }
        if (shared === 'shared') { setMessage('Mở tệp trong Lịch và xác nhận thêm sự kiện để nhận nhắc.'); return; }
      }
      downloadText(filename, calendar, mime);
      setMessage('Đã tạo tệp lịch. Mở tệp, thêm sự kiện và bật cảnh báo trong Lịch.');
    } catch { setMessage('Chưa tạo được lịch. Hãy thử lại.'); }
  }
  return <details className="lesson-reminder">
    <summary>Nhắc ôn định kỳ bài này</summary>
    <div className="stack">
      <p>{prompt}</p>
      <p className="hint">{prefs.remindDays.length ? `Nhắc lúc ${prefs.remindAt} (giờ Việt Nam) · ${prefs.remindDays.map((d) => DAY_SHORT_VI[d]).join(', ')} hằng tuần.` : 'Chọn ít nhất một ngày nhắc trong Cài đặt.'} Sau khi thêm sự kiện, Lịch trên máy sẽ báo cả khi đóng app. Có thể sửa hoặc xóa sự kiện trong Lịch.</p>
      <div className="row">
        <button type="button" className="btn ghost" disabled={!prefs.remindDays.length} onClick={() => void exportLesson()}>Tạo lời nhắc cho bài</button>
        <a className="btn ghost roadmap-link" href="#cai-dat?nhac=1">Chọn giờ và ngày nhắc</a>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}
