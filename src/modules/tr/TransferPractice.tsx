import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { addDays } from '../../core/date';
import { db } from '../../core/db';
import { anchorDay, readTransfer, saveTransfer, startTransfer, transferAnchor, transferPrefix, type TransferDay, type TransferResult } from '../../core/transfer';
import { memoLessons, useReadingMemos } from './readingMemos';
import { useProgress } from '../../ui/useProgress';
import { useFocusOnMount } from '../../ui/useFocusOnMount';

const tasks = [
  { offset: 7, title: 'Chọn nguồn cho trưởng ca dịch vụ', modules: ['08', '11'],
    prompt: 'Một trưởng ca phân công 12 nhân viên chăm sóc khách hàng tại một điểm, trưởng bộ phận duyệt ngân sách. Mẫu X có cùng chức danh, phụ trách năm điểm và duyệt chi, P50 là 31 triệu đồng/tháng. Mẫu Y giám sát một điểm, trình duyệt chi, P50 là 26 triệu nhưng dữ liệu đã chín tháng. Trưởng vận hành muốn lấy X để giữ người. Bạn chọn nguồn nào, cần kiểm tra gì và sẽ trả lời trưởng vận hành ra sao?',
    criteria: ['Đối chiếu phạm vi một điểm và quyền trình duyệt.', 'Nhận ra giới hạn thời điểm của Y và nêu dữ liệu cần xác minh.', 'Tách nhu cầu giữ người khỏi lựa chọn nguồn tham chiếu.'],
    guide: 'Chọn Y làm điểm xuất phát vì cùng phạm vi và quyền hạn. Hỏi nhà cung cấp về biến động thị trường trong chín tháng. Có thể trình riêng phương án giữ người với dữ liệu nghỉ việc, mức cạnh tranh và ngân sách.' },
  { offset: 30, title: 'Giải trình chi phí với giám đốc nhà máy', modules: ['10', '11'],
    prompt: 'Giám đốc nhà máy đề xuất tăng 4% từ đầu tháng 10 cho 24 người có lương cơ bản bình quân 25 triệu đồng/tháng. Quỹ tăng thêm năm nay là 90 triệu. Ông muốn ghi 72 triệu vào cả ngân sách năm sau. Bạn phản hồi thế nào nếu nhân sự và mức lương mới giữ nguyên?',
    criteria: ['Tính đúng phần tăng mỗi tháng và trong ba tháng cuối năm.', 'Phân biệt quỹ còn lại năm nay với chi phí tăng đủ 12 tháng.', 'Nêu giả định và bước xác nhận ngân sách năm sau.'],
    guide: 'Mỗi tháng tăng 24 × 25 × 4% = 24 triệu. Năm nay chi thêm 72 triệu và còn 18 triệu. So với nền lương trước tăng, tác động đủ năm là 288 triệu. Xác nhận lại định biên, mức lương và phần đã nằm trong dự toán trước khi chốt ngân sách.' },
] as const;

type Task = typeof tasks[number];
const dateLabel = (d: string) => d.split('-').reverse().join('/');

export function TransferPractice({ today }: { today: string }) {
  const [rows, setRows] = useState<Map<string, unknown> | null>();
  const [active, setActive] = useState<TransferDay>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const sub = liveQuery(() => db.settings.where('key').startsWith(transferPrefix).toArray()).subscribe({
      next: (values) => setRows(new Map(values.map((r) => [r.key, r.value]))), error: () => setRows(null),
    });
    return () => sub.unsubscribe();
  }, []);
  const start = anchorDay(rows?.get(transferAnchor));
  return <section className="roadmap-review stack transfer-practice" aria-labelledby="transfer-title">
    <h3 id="transfer-title">Vận dụng sau 7 và 30 ngày</h3>
    {rows === undefined ? <p>Đang đọc lịch vận dụng…</p> : rows === null ? <p role="alert">Chưa đọc được lịch trên máy.</p> : !start ? <>
      <p>Tiến độ cũ chỉ lưu những bài đã hoàn thành. Bắt đầu từ hôm nay để hẹn hai tình huống mới sau 7 và 30 ngày.</p>
      <div className="row"><button className="btn" onClick={() => { void startTransfer(today).catch(() => setError(true)); }}>Bắt đầu lịch vận dụng</button></div>
      {error && <p role="alert">Chưa lưu được ngày bắt đầu. Hãy thử lại.</p>}
    </> : tasks.map((task) => {
      const due = addDays(start, task.offset);
      const saved = readTransfer(rows.get(transferPrefix + task.offset));
      const ready = today >= due || !!saved;
      return <div className="stack" key={task.offset}>
        <h4>Ngày {task.offset} · {task.title}</h4>
        <p>{saved ? 'Đã đối chiếu' : ready ? 'Đã đến hạn' : 'Đến hạn'} · {dateLabel(due)}
          {saved && ' · đạt ' + saved.criteria.filter(Boolean).length + '/3 tiêu chí tự đánh giá'}</p>
        {ready && <div className="row"><button type="button" className="btn ghost" aria-expanded={active === task.offset} onClick={() => setActive(active === task.offset ? undefined : task.offset)}>
          {active === task.offset ? 'Đóng' : saved ? 'Xem kết quả' : 'Làm tình huống'} ngày {task.offset}</button></div>}
        {active === task.offset && ready && <TransferAnswer key={task.offset} task={task} saved={saved} />}
      </div>;
    })}
  </section>;
}

function TransferAnswer({ task, saved }: { task: Task; saved: TransferResult | undefined }) {
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [criteria, setCriteria] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const progress = useProgress();
  const notes = useReadingMemos();
  const relevant = notes?.filter((n) => task.modules.some((m) => n.id.startsWith('trm-' + m + '-')));
  const heading = useFocusOnMount<HTMLHeadingElement>(revealed);
  async function finish() {
    setBusy(true); setError(false);
    try {
      await progress.flush();
      await saveTransfer(task.offset, draft, criteria);
      await progress.load(true);
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <div className="stack">
    <p>{task.prompt}</p>
    {revealed || saved ? <>
      <h4 tabIndex={-1} ref={heading}>Đối chiếu bài làm</h4><p>{saved?.response ?? draft}</p><p>{task.guide}</p>
      <details><summary>Xem memo các buổi liên quan</summary>
        {relevant?.length ? relevant.map((n) => <p key={n.id}><strong>{memoLessons.get(n.id)?.lesson.title}</strong> · {n.text}</p>) :
          <p>{notes === undefined ? 'Đang đọc memo…' : notes === null ? 'Chưa đọc được memo.' : 'Chưa có memo ở các buổi liên quan.'}</p>}</details>
      {saved ? <ul>{task.criteria.map((c, i) => <li key={c}>{saved.criteria[i] ? 'Đã làm được' : 'Cần luyện'} · {c}</li>)}</ul> : <>
        <fieldset className="checkpoint-question"><legend>Đánh dấu những tiêu chí đã có trong câu trả lời</legend>{task.criteria.map((c, i) =>
          <label key={c}><input type="checkbox" checked={criteria[i]} onChange={(e) => setCriteria(criteria.map((v, j) => j === i ? e.target.checked : v))} />{c}</label>)}</fieldset>
        <div className="row"><button type="button" className="btn" disabled={busy} onClick={() => void finish()}>Lưu tự đánh giá</button></div>
        {error && <p role="alert">Chưa lưu được lượt vận dụng. Hãy thử lại.</p>}
      </>}
    </> : <form className="stack" onSubmit={(e) => { e.preventDefault(); setRevealed(true); }}>
      <label className="field">Quyết định và căn cứ của bạn<textarea required maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
      <div className="row"><button className="btn" disabled={!draft.trim()}>Đối chiếu rồi mở memo</button></div>
    </form>}
  </div>;
}
