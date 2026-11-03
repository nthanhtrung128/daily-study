import { useRef, useState } from 'react';
import {
  BackupError,
  applyBackup,
  backupFileName,
  exportBackup,
  parseBackup,
  readLegacyLocal,
  summarize,
  type ImportMode,
  type ParsedBackup,
} from '../../core/backup';
import { reloadDailyPrefs } from '../useDailyPrefs';
import { fmt } from '../../core/num';
import { totals } from '../../modules/progress/stats';
import { useProgress } from '../useProgress';

/** Xuất / nhập tiến độ (JSON) — đọc được cả state Sổ ôn bản cũ. Không gửi dữ liệu đi đâu. */
type Status = { kind: 'ok' | 'err'; text: string } | null;

const vnDay = (d: string) => (d ? d.split('-').reverse().join('/') : '');

export function BackupPanel() {
  const p = useProgress();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: ParsedBackup; from: string } | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const legacyLocal = readLegacyLocal();

  let tracked = 0;
  for (const [, s] of p.entries()) if (s.box > 0) tracked++;
  const curReviews = totals(p.allDays()).n;

  const doExport = async () => {
    setStatus(null);
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const s = summarize(data);
      setStatus({ kind: 'ok', text: `Đã xuất ${s.items} mục, ${fmt(s.reviews)} lượt ôn, ${s.notes} ghi chú.` });
    } catch {
      setStatus({ kind: 'err', text: 'Không đọc được dữ liệu trên máy để xuất.' });
    }
  };

  const read = (text: string, from: string) => {
    setStatus(null);
    try {
      setPending({ data: parseBackup(text), from });
      setPaste(null);
    } catch (e) {
      setPending(null);
      setStatus({ kind: 'err', text: e instanceof BackupError ? e.message : 'Không đọc được file.' });
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      read(await f.text(), `file “${f.name}”`);
    } catch {
      setStatus({ kind: 'err', text: 'Không đọc được file.' });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const apply = async (mode: ImportMode) => {
    if (!pending) return;
    setBusy(true);
    try {
      await applyBackup(pending.data, mode);
      await p.load(true);
      reloadDailyPrefs();
      const s = summarize(pending.data);
      setStatus({
        kind: 'ok',
        text: `${mode === 'replace' ? 'Đã thay' : 'Đã gộp'} tiến độ từ ${pending.from}: ${s.items} mục, ${fmt(s.reviews)} lượt ôn, ${s.notes} ghi chú.`,
      });
      setPending(null);
    } catch {
      setStatus({ kind: 'err', text: 'Ghi vào bộ nhớ máy không thành công. Dữ liệu cũ vẫn giữ nguyên.' });
    }
    setBusy(false);
  };

  const s = pending ? summarize(pending.data) : null;

  return (
    <div className="stack backup">
      <div className="eyebrow">Sao lưu tiến độ</div>
      <p className="hint">
        Xuất file JSON để lưu dự phòng hoặc chuyển sang máy khác. Nhập được file của app này và state của Sổ ôn bản cũ (khóa
        <code> tr101.state.v1</code>).
      </p>
      <div className="row">
        <button type="button" className="btn" onClick={() => void doExport()}>
          Xuất tiến độ (.json)
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          Nhập từ file…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json,text/plain"
          hidden
          data-testid="import-file"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <button type="button" className="btn ghost small" aria-expanded={paste !== null} onClick={() => setPaste(paste === null ? '' : null)}>
          Dán JSON
        </button>
      </div>

      {legacyLocal && !pending && (
        <div className="row">
          <button type="button" className="btn ghost small" onClick={() => read(legacyLocal, 'Sổ ôn bản cũ trên trình duyệt này')}>
            Nhập tiến độ Sổ ôn bản cũ tìm thấy trên máy
          </button>
        </div>
      )}

      {paste !== null && (
        <div className="field">
          <textarea
            aria-label="Nội dung JSON"
            placeholder='Dán nội dung file xuất, hoặc state bản cũ: {"srs":{…},"days":{…},"notes":{…}}'
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="row">
            <button type="button" className="btn small" disabled={!paste.trim()} onClick={() => read(paste, 'nội dung đã dán')}>
              Đọc dữ liệu
            </button>
          </div>
        </div>
      )}

      {pending && s && (
        <div className="confirm" role="alertdialog" aria-labelledby="imp-title" aria-describedby="imp-desc">
          <b id="imp-title">
            Nhập {pending.data.source === 'legacy' ? 'state Sổ ôn bản cũ' : 'bản sao lưu'} từ {pending.from}?
          </b>
          <ul id="imp-desc" className="imp-sum">
            <li>
              Trong dữ liệu nhập: <b className="num">{s.items}</b> mục đã học (<span className="num">{s.learned}</span> đã thuộc,{' '}
              <span className="num">{s.wrong}</span> từng sai), <b className="num">{fmt(s.reviews)}</b> lượt ôn trong{' '}
              <span className="num">{s.days}</span> ngày{s.firstDay ? ` (${vnDay(s.firstDay)} – ${vnDay(s.lastDay)})` : ''},{' '}
              <span className="num">{s.notes}</span> ghi chú.
            </li>
            <li>
              Trên máy hiện có: <b className="num">{tracked}</b> mục đã học, <b className="num">{fmt(curReviews)}</b> lượt ôn.
            </li>
            {pending.data.skipped > 0 && <li>Bỏ qua {pending.data.skipped} dòng sai định dạng.</li>}
          </ul>
          <p className="hint">
            <b>Thay thế</b> xóa tiến độ, nhật ký và ghi chú hiện có trên máy rồi ghi dữ liệu nhập. <b>Gộp</b> giữ cả hai: mỗi mục
            lấy lần ôn gần nhất, ghi chú lấy bản mới hơn.
          </p>
          <div className="row">
            <button type="button" className="btn danger" disabled={busy} onClick={() => void apply('replace')}>
              Thay thế
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void apply('merge')}>
              Gộp
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setPending(null)}>
              Hủy
            </button>
          </div>
        </div>
      )}

      {status && (
        <p className={`status ${status.kind}`} role="status" data-testid="backup-status">
          {status.text}
        </p>
      )}
    </div>
  );
}
