import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db, type Recording } from '../../core/db';
import { dayKey } from '../../core/date';
import { fmtDur, recordingBlob } from '../english/speech/recordings';
import { capstoneCriteria, capstoneHref } from './Capstone';
import { equityCriteria, equityHref } from './PayEquityCase';
import { offerCriteria, offerHref } from './OfferCase';
import { useCaseAttempts } from './caseAttempts';

const cases = [
  { id: 'capstone', name: 'Đề xuất giữ người', href: capstoneHref, criteria: capstoneCriteria, topic: 'tr-capstone-retention' },
  { id: 'equity', name: 'Công bằng lương', href: equityHref, criteria: equityCriteria, topic: 'tr-case-equity' },
  { id: 'offers', name: 'Hai thư mời', href: offerHref, criteria: offerCriteria, topic: 'tr-case-offers' },
];
const when = (at: number) => new Date(at).toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const mark = (v: boolean) => v ? 'Đạt' : 'Cần luyện';

export function CasePortfolio() {
  const [active, setActive] = useState(cases[0]!);
  return <section className="panel stack" aria-labelledby="portfolio-title"><h2 className="h-sec" id="portfolio-title">Hồ sơ tiến bộ</h2>
    <div className="row" role="group" aria-label="Chọn nhiệm vụ để so sánh">{cases.map((c) =>
      <button className="chip" aria-pressed={active.id === c.id} onClick={() => setActive(c)} key={c.id}>{c.name}</button>)}</div>
    <Comparison key={active.id} task={active} />
  </section>;
}

function Comparison({ task }: { task: typeof cases[number] }) {
  const attempts = useCaseAttempts(task.id);
  const latest = attempts?.[0];
  const previous = latest && (attempts?.slice(1).find((r) => dayKey(new Date(r.at)) !== dayKey(new Date(latest.at))) ?? attempts?.[1]);
  return <div className="stack">
    {attempts === null ? <p role="alert">Chưa đọc được phiếu đã lưu.</p> : attempts === undefined ? <p>Đang mở hồ sơ…</p> : latest ? <>
      <h3>Đối chiếu theo tiêu chí</h3>
      {previous ? <p>Lần trước · {when(previous.at)}<br />Lần gần nhất · {when(latest.at)}</p> : <p>Đã có một phiếu ngày {when(latest.at)}. Khi có lần làm sau, bạn sẽ thấy hai kết quả cùng nhau.</p>}
      <ul>{task.criteria.map((c, i) => <li key={c}><strong>{c}</strong> · {i === 2 ? 'tự đánh giá' : 'đối chiếu đáp án'}<br />
        {previous && 'Lần trước: ' + mark(previous.criteria[i]!) + ' · '}Gần nhất: {mark(latest.criteria[i]!)}</li>)}</ul>
      {[previous, latest].map((r, i) => r && <details className="portfolio-entry" key={i}><summary>{i === 0 ? 'Đọc phiếu lần trước' : 'Đọc phiếu gần nhất'}</summary><p className="case-response">{r.response}</p></details>)}
    </> : <p>Chưa có phiếu cho nhiệm vụ này. Nộp một bài để lưu mốc đầu tiên.</p>}
    <a className="btn ghost roadmap-link" href={task.href}>Mở bài · {task.name}</a>
    <VoiceComparison topic={task.topic} />
  </div>;
}

function VoiceComparison({ topic }: { topic: string }) {
  const [rows, setRows] = useState<Recording[] | null>();
  useEffect(() => {
    const sub = liveQuery(() => db.recordings.orderBy('at').reverse().filter((r) => r.topicId === topic).limit(2).toArray()).subscribe({
      next: setRows, error: () => setRows(null),
    });
    return () => sub.unsubscribe();
  }, [topic]);
  return <div className="stack"><h3>Nghe lại cùng nhiệm vụ</h3>
    {rows === null ? <p role="alert">Chưa đọc được bản ghi trên máy.</p> : rows === undefined ? <p>Đang đọc bản ghi…</p> :
      !rows.length ? <p>Chưa có bản ghi cho nhiệm vụ này.</p> :
      <><p>Nghe hai lượt gần nhất nếu có. Chú ý câu nêu quyết định và số liệu bạn dùng làm căn cứ.</p>
        {[...rows].reverse().map((r) => <VoiceEntry key={r.id} recording={r} />)}</>}
  </div>;
}

function VoiceEntry({ recording }: { recording: Recording }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(recordingBlob(recording));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL của Blob phải được thu hồi cùng vòng đời player.
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [recording]);
  return <div className="stack portfolio-voice"><strong>{when(recording.at)} · {fmtDur(recording.ms)}</strong>
    {url && <audio controls preload="metadata" src={url} aria-label={'Nghe bản ghi ngày ' + when(recording.at)} />}</div>;
}
