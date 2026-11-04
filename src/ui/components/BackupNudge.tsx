import { useState } from 'react';
import { daysSince, shouldRemind } from '../../core/backupReminder';
import { useProgress } from '../useProgress';
import { reminderReady, requestBackupFocus, snoozeReminder, useBackupReminder } from '../useBackupReminder';

/** Dải nhắc nhẹ trên trang Hôm nay khi lâu chưa xuất sao lưu. "Để sau" ẩn 3 ngày. */
export function BackupNudge({ at }: { at?: number }) {
  const [mounted] = useState(() => Date.now());
  const now = at ?? mounted;
  const p = useProgress();
  const r = useBackupReminder();
  if (!p.loaded || !reminderReady()) return null;
  const studyDays: string[] = [];
  for (const d of p.allDays()) if (d.n > 0) studyDays.push(d.day);
  if (!shouldRemind(r, studyDays, now)) return null;
  const text =
    r.lastAt === null
      ? 'Bạn chưa sao lưu tiến độ lần nào. Tiến độ và ghi âm chỉ nằm trên máy này — xuất một file để phòng khi mất dữ liệu.'
      : `Đã ${daysSince(r.lastAt, now)} ngày chưa sao lưu tiến độ. Xuất một file mới để phòng khi mất dữ liệu.`;
  return (
    <div className="backup-nudge" role="region" aria-labelledby="nudge-title" data-testid="backup-nudge">
      <p className="nudge-text">
        <b id="nudge-title">Nhắc sao lưu.</b> {text}
      </p>
      <div className="row">
        <a className="btn small link-btn" href="#cai-dat" onClick={requestBackupFocus}>
          Sao lưu ngay
        </a>
        <button type="button" className="btn ghost small" onClick={() => snoozeReminder(Math.max(now, Date.now()))}>
          Để sau
        </button>
      </div>
    </div>
  );
}
