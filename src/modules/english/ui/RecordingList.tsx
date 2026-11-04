import { useEffect, useState } from 'react';
import { extFor } from '../speech/recorder';
import { deleteRecording, fmtDur, fmtSize, listRecordings, recordingBlob, type Recording } from '../speech/recordings';

const fmtWhen = (at: number) =>
  new Date(at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Danh sách bản ghi trên máy: nghe lại, tải về, xóa (bấm 2 lần để chắc chắn). */
export function RecordingList({ topicId, refresh = 0, showTitle = false, limit }: { topicId?: string; refresh?: number; showTitle?: boolean; limit?: number }) {
  const [rows, setRows] = useState<Recording[] | null>(null);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [confirm, setConfirm] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [all, setAll] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    void listRecordings(topicId)
      .then((r) => live && setRows(r))
      .catch(() => {
        if (!live) return;
        setRows([]);
        setErr('Không đọc được bản ghi trên máy (trình duyệt chặn lưu trữ).');
      });
    return () => {
      live = false;
    };
  }, [topicId, refresh, tick]);

  // Object URL cho từng bản ghi; thu hồi khi danh sách đổi hoặc rời màn.
  useEffect(() => {
    if (!rows || typeof URL.createObjectURL !== 'function') return;
    const map: Record<number, string> = {};
    for (const r of rows) if (r.id !== undefined) map[r.id] = URL.createObjectURL(recordingBlob(r));
    // Object URL là tài nguyên bên ngoài React (phải thu hồi khi dọn) nên tạo trong effect;
    // tạo bằng useMemo sẽ bị StrictMode thu hồi rồi không tạo lại.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls(map);
    return () => {
      for (const u of Object.values(map)) URL.revokeObjectURL(u);
    };
  }, [rows]);

  useEffect(() => {
    if (confirm === null) return;
    const t = setTimeout(() => setConfirm(null), 4000);
    return () => clearTimeout(t);
  }, [confirm]);

  if (!rows) return null;
  const errBox = err ? (
    <p className="say-err" role="alert">
      {err}
    </p>
  ) : null;
  if (!rows.length)
    return (
      <>
        {errBox}
        <p className="hint" data-testid="rec-empty">
          Chưa có bản ghi nào. Bản ghi chỉ lưu trên máy này.
        </p>
      </>
    );
  const total = rows.reduce((a, r) => a + r.size, 0);
  const visible = limit && !all ? rows.slice(0, limit) : rows;

  return (
    <div className="stack rec-list-wrap">
      <ul className="rec-list" aria-label="Bản ghi">
        {visible.map((r) => {
          const id = r.id as number;
          const url = urls[id];
          return (
            <li key={id} className="rec-item" data-testid="rec-item">
              <div className="rec-meta">
                <span className="num">{fmtWhen(r.at)}</span>
                <span className="tag num">{fmtDur(r.ms)}</span>
                <span className="hint">{fmtSize(r.size)}</span>
              </div>
              {showTitle && (
                <p className="rec-title" lang="en">
                  {r.title}
                </p>
              )}
              {url ? <audio controls preload="metadata" src={url} aria-label={`Nghe lại bản ghi ${fmtWhen(r.at)}`} /> : null}
              {r.transcript && (
                <details>
                  <summary className="hint">Chữ nhận được</summary>
                  <p lang="en" className="rec-tr">
                    {r.transcript}
                  </p>
                </details>
              )}
              <div className="row">
                {url && (
                  <a className="btn ghost small" href={url} download={`de-noi-${r.topicId}-${new Date(r.at).toISOString().slice(0, 16).replace(/[:T]/g, '')}.${extFor(r.mime)}`}>
                    Tải về
                  </a>
                )}
                <button
                  type="button"
                  className={`btn ghost small${confirm === id ? ' rec-danger' : ''}`}
                  onClick={() => {
                    if (confirm !== id) return setConfirm(id);
                    setConfirm(null);
                    setErr('');
                    void deleteRecording(id)
                      .then(() => setTick((x) => x + 1))
                      .catch(() => setErr('Không xóa được bản ghi. Thử lại sau.'));
                  }}
                >
                  {confirm === id ? 'Bấm lần nữa để xóa' : 'Xóa'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {visible.length < rows.length && (
        <div>
          <button type="button" className="btn ghost small" onClick={() => setAll(true)}>
            Xem tất cả ({rows.length})
          </button>
        </div>
      )}
      {errBox}
      <p className="hint">
        {rows.length} bản ghi · {fmtSize(total)} · chỉ lưu trên máy này (không gửi đi đâu).
      </p>
    </div>
  );
}
