import { missStore } from '../../core/misswords';
import { useEffect, useRef, useState } from 'react';
import {
  BackupError,
  LARGE_FILE_BYTES,
  applyBackup,
  backupFileName,
  backupParts,
  exportBackup,
  parseBackup,
  recordingStats,
  readLegacyLocal,
  summarize,
  type ImportMode,
  type ParsedBackup,
} from '../../core/backup';
import { reloadDailyPrefs } from '../useDailyPrefs';
import { isStandalone, shareFile } from '../mix/download';
import { fmt } from '../../core/num';
import { totals } from '../../modules/progress/stats';
import { useProgress } from '../useProgress';
import { db, isQuotaError } from '../../core/db';
import { REMIND_CHOICES, daysSince, everyLabel, fmtWhen } from '../../core/backupReminder';
import { fmtSize } from '../../modules/english/speech/recordings';
import { markBackedUp, reloadReminder, setRemindEvery, takeBackupFocus, useBackupReminder } from '../useBackupReminder';
import './backup.css';

/** Xuất / nhập tiến độ (JSON) — đọc được cả state Sổ ôn bản cũ. Không gửi dữ liệu đi đâu. */
type Status = { kind: 'ok' | 'err'; text: string } | null;

const vnDay = (d: string) => (d ? d.split('-').reverse().join('/') : '');

export function BackupPanel() {
  const p = useProgress();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: ParsedBackup; from: string; bytes: number } | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** File sao lưu đã tạo, chờ bấm lần nữa để mở bảng Chia sẻ (iOS đòi thao tác bấm mới). */
  const [shareReady, setShareReady] = useState<File | null>(null);
  const legacyLocal = readLegacyLocal();
  const remind = useBackupReminder();
  /** Số bản ghi âm trên máy và dung lượng ước tính khi kèm vào file. */
  const [recs, setRecs] = useState<{ count: number; bytes: number } | null>(null);
  const [withRec, setWithRec] = useState(false);
  const exportRef = useRef<HTMLButtonElement>(null);
  const [now] = useState(() => Date.now());

  const loadRecs = () =>
    recordingStats(db)
      .then(setRecs)
      .catch(() => setRecs(null));

  useEffect(() => {
    void loadRecs();
    // Đến từ nút "Sao lưu ngay" ở trang Hôm nay → cuộn tới đây.
    if (takeBackupFocus()) {
      // Giữa màn hình: thanh tab dính ở trên có thể che phần đầu.
      exportRef.current?.scrollIntoView?.({ block: 'center' });
      exportRef.current?.focus({ preventScroll: true });
    }
  }, []);

  let tracked = 0;
  for (const [, s] of p.entries()) if (s.box > 0) tracked++;
  const curReviews = totals(p.allDays()).n;

  const share = async (file: File, okText: string) => {
    const r = await shareFile(file);
    if (r === 'shared') {
      markBackedUp();
      setShareReady(null);
      setStatus({ kind: 'ok', text: okText });
    } else if (r === 'cancelled') {
      setShareReady(file);
      setStatus({ kind: 'err', text: 'Chưa lưu file. Bấm “Lưu file sao lưu” rồi chọn “Lưu vào Tệp”.' });
    } else if (r === 'needs-tap') {
      setShareReady(file);
      setStatus({ kind: 'ok', text: 'File sao lưu đã sẵn sàng. Bấm “Lưu file sao lưu” rồi chọn “Lưu vào Tệp”.' });
    }
    return r;
  };

  const doExport = async () => {
    setStatus(null);
    setShareReady(null);
    try {
      const rec = withRec && !!recs?.count;
      const data = await exportBackup(db, new Date(), { recordings: rec });
      // Nhiều đoạn (mỗi bản ghi âm một đoạn) thay vì một chuỗi lớn: đỡ tốn bộ nhớ trên iPhone.
      const parts = backupParts(data);
      const s = summarize(data);
      const okText = `Đã xuất ${s.items} mục, ${fmt(s.reviews)} lượt ôn, ${s.notes} ghi chú${rec ? `, ${s.recordings} bản ghi âm` : ''}.`;
      // App ở Màn hình chính trên iPhone: <a download> có thể không làm gì → dùng bảng Chia sẻ (Lưu vào Tệp).
      if (isStandalone() && typeof File === 'function') {
        const r = await share(new File(parts, backupFileName(), { type: 'application/json' }), okText);
        if (r !== 'unsupported') return;
      }
      const blob = new Blob(parts, { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      markBackedUp();
      setStatus({ kind: 'ok', text: okText });
    } catch {
      setStatus({ kind: 'err', text: 'Không đọc được dữ liệu trên máy để xuất.' });
    }
  };

  const read = (text: string, from: string, bytes = text.length) => {
    setStatus(null);
    try {
      setPending({ data: parseBackup(text), from, bytes });
      setPaste(null);
    } catch (e) {
      setPending(null);
      setStatus({ kind: 'err', text: e instanceof BackupError ? e.message : 'Không đọc được file.' });
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      read(await f.text(), `file “${f.name}”`, f.size);
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
      await missStore.load();
      reloadDailyPrefs();
      reloadReminder();
      void loadRecs();
      const s = summarize(pending.data);
      setStatus({
        kind: 'ok',
        text: `${mode === 'replace' ? 'Đã thay' : 'Đã gộp'} tiến độ từ ${pending.from}: ${s.items} mục, ${fmt(s.reviews)} lượt ôn, ${s.notes} ghi chú${
          pending.data.recordings ? `, ${s.recordings} bản ghi âm` : ''
        }.`,
      });
      setPending(null);
    } catch (e) {
      setStatus({
        kind: 'err',
        text: isQuotaError(e)
          ? 'Máy không còn đủ dung lượng để lưu dữ liệu nhập (thường do bản ghi âm). Dữ liệu cũ vẫn giữ nguyên.'
          : 'Ghi vào bộ nhớ máy không thành công. Dữ liệu cũ vẫn giữ nguyên.',
      });
    }
    setBusy(false);
  };

  const s = pending ? summarize(pending.data) : null;
  const bigExport = withRec && (recs?.bytes ?? 0) > LARGE_FILE_BYTES;

  return (
    <div className="stack backup" id="sao-luu">
      <div className="eyebrow">Sao lưu tiến độ</div>
      <p className="hint">
        Xuất file JSON để lưu dự phòng hoặc chuyển sang máy khác. Nhập được file của app này và state của Sổ ôn bản cũ (khóa
        <code> tr101.state.v1</code>).
      </p>
      <p className="hint bk-last" data-testid="backup-last">
        {remind.lastAt === null
          ? 'Lần sao lưu gần nhất: chưa có trên máy này.'
          : `Lần sao lưu gần nhất: ${fmtWhen(remind.lastAt)}${daysSince(remind.lastAt, now) ? ` (${daysSince(remind.lastAt, now)} ngày trước)` : ' (hôm nay)'}.`}
      </p>
      {!!recs?.count && (
        <div className="row">
          <button type="button" className="chip" aria-pressed={withRec} onClick={() => setWithRec(!withRec)} data-testid="with-rec">
            Kèm bản ghi âm (≈ {fmtSize(recs.bytes)})
          </button>
          <span className="hint">{recs.count} bản ghi</span>
        </div>
      )}
      {bigExport && (
        <p className="bk-warn" role="note">
          File sẽ khá lớn. Trên iPhone, lưu / mở file cỡ này có thể chậm hoặc không thành công; nên xóa bớt bản ghi cũ trong “Đề nói 1 phút”
          hoặc xuất không kèm ghi âm.
        </p>
      )}
      <div className="row">
        <button ref={exportRef} type="button" className="btn" onClick={() => void doExport()}>
          Xuất tiến độ (.json)
        </button>
        {shareReady && (
          <button type="button" className="btn" onClick={() => void share(shareReady, 'Đã mở bảng Chia sẻ để lưu file sao lưu.')}>
            Lưu file sao lưu
          </button>
        )}
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
            {pending.data.recordings && (
              <li>
                Bản ghi âm trong file: <b className="num">{s.recordings}</b>
                {recs ? ` (trên máy hiện có ${recs.count})` : ''}.
              </li>
            )}
            {pending.data.skipped > 0 && <li>Bỏ qua {pending.data.skipped} dòng sai định dạng.</li>}
            {pending.bytes > LARGE_FILE_BYTES && (
              <li>File lớn ({fmtSize(pending.bytes)}): ghi vào máy có thể mất một lúc, đừng đóng app.</li>
            )}
          </ul>
          <p className="hint">
            <b>Thay thế</b> xóa tiến độ, nhật ký và ghi chú hiện có trên máy rồi ghi dữ liệu nhập. <b>Gộp</b> giữ cả hai: mỗi mục
            lấy lần ôn gần nhất, ghi chú lấy bản mới hơn.
            {pending.data.recordings
              ? ' Ghi âm: thay thế dùng đúng các bản trong file; gộp chỉ thêm bản chưa có.'
              : ' File không có ghi âm nên ghi âm trên máy giữ nguyên.'}
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

      <div className="set-group">
        <div className="eyebrow" id="lbl-bk-remind">
          Nhắc sao lưu trên trang Hôm nay
        </div>
        <div className="row" role="group" aria-labelledby="lbl-bk-remind">
          {REMIND_CHOICES.map((e) => (
            <button key={e} type="button" className="chip" aria-pressed={remind.every === e} onClick={() => setRemindEvery(e)}>
              {e ? `Mỗi ${everyLabel(e)}` : 'Tắt'}
            </button>
          ))}
        </div>
        <p className="hint">Chỉ nhắc trong app, khi đã quá số ngày chưa xuất file sao lưu. Bấm “Để sau” thì ẩn 3 ngày.</p>
      </div>
    </div>
  );
}
