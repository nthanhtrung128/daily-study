import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { dayKey } from '../../../core/date';
import { weekStart } from '../../../core/studytime';
import { workWeekSnapshot, type WorkWeekEntry } from '../../../core/workWeek';
import { StoredMemo } from '../../../ui/components/ReadingMemos';
import { useFocusOnMount } from '../../../ui/useFocusOnMount';
import { nextWeek, prevWeek, weekLabel } from '../../progress/week';
import { useWorkChoice } from '../useWorkChoice';
import { journalHref, workHref, workTopics, type WorkTopic } from '../workTopics';
import { RecordingList } from './RecordingList';

export function WorkWeekJournal({ selected, week }: { selected: string | null; week: string | null }) {
  const choice = useWorkChoice();
  const topic = workTopics.find(t => t.id === selected) ?? workTopics.find(t => t.id === choice);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const current = weekStart(dayKey());
  const start = week && /^\d{4}-\d\d-\d\d$/.test(week) && week <= current && weekStart(week) === week ? week : current;
  useEffect(() => { window.scrollTo(0, 0); }, [selected, week]);
  return <section className="panel stack work-week" aria-labelledby="journal-title">
    <div><a className="btn ghost roadmap-link" href="#hom-nay">Về Hôm nay</a></div>
    <h1 className="h-page" id="journal-title" ref={heading} tabIndex={-1}>Nhìn lại tuần</h1>
    <div className="wk-head">
      <p className="wk-range" aria-live="polite">Tuần {weekLabel(start)} · {start.slice(0, 4)}</p>
      <div className="row">
        <a className="btn ghost small roadmap-link" href={journalHref(topic?.id, prevWeek(start))}>Tuần trước</a>
        {start < current ? <a className="btn ghost small roadmap-link" href={journalHref(topic?.id, nextWeek(start))}>Tuần sau</a>
          : <button className="btn ghost small" disabled>Tuần sau</button>}
      </div>
    </div>
    {topic && <h2 className="h-sec">{topic.title}</h2>}
    <details key={topic?.id ?? 'chon'} open={topic ? undefined : true}><summary>{topic ? 'Đổi tình huống xem lại' : 'Chọn tình huống xem lại'}</summary>
      <ul className="memo-list" role="list">{workTopics.map(t => <li key={t.id}>
        <a className="reading-result-link" href={journalHref(t.id, start)} aria-current={t.id === topic?.id ? 'true' : undefined}>{t.title}</a>
      </li>)}</ul>
    </details>
    {topic ? <JournalEntries key={topic.id + start} topic={topic} start={start} /> :
      choice === null && <p role="alert">Chưa đọc được lựa chọn trên máy. Bạn có thể chọn tình huống ở trên.</p>}
  </section>;
}

function JournalEntries({ topic, start }: { topic: WorkTopic; start: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof workWeekSnapshot>> | null>();
  useEffect(() => {
    const subscription = liveQuery(() => workWeekSnapshot(topic.id, topic.lines.length, start)).subscribe({
      next: setData, error: () => setData(null),
    });
    return () => subscription.unsubscribe();
  }, [topic, start]);
  return <>
    {data === undefined ? <p role="status">Đang đọc các lượt luyện…</p> : data === null ? <p role="alert">Chưa đọc được các lượt luyện trên máy.</p>
      : data.count === 0 ? <p>Tuần này chưa có lượt nào cho tình huống này.</p> : <>
        <p className="hint">{data.count} lượt trong tuần. {data.entries.length === 1 ? 'Luyện thêm một lượt để có hai lần đối chiếu.' : 'Đọc hoặc nghe lại hai lần trả lời.'}</p>
        {data.entries.map((entry, i) => <JournalEntry key={entry.review.itemId} entry={entry} topic={topic} start={start}
          label={i === data.entries.length - 1 ? 'Lần gần nhất' : 'Lần trước'} />)}
      </>}
    <StoredMemo id={'en:weekly-reflection:' + topic.id + ':' + start} title="Memo cuối tuần"
      prompt="Bạn đã dùng câu nào trong công việc? Bạn muốn luyện tiếp tình huống này hay thử tình huống nào khác?" />
    <div><a className="btn roadmap-link" href={workHref(topic.id)}>Luyện một câu · 2 phút</a></div>
  </>;
}

function JournalEntry({ topic, entry, start, label }: { topic: WorkTopic; entry: WorkWeekEntry; start: string; label: string }) {
  const { review, memo, hasRecording } = entry;
  const [open, setOpen] = useState(false);
  const when = new Date(review.at);
  const stamp = when.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return <article className="stack roadmap-review" aria-label={label}>
    <h3>{label}</h3>
    <p className="hint"><time dateTime={review.day}>{stamp}</time>{review.day < start && ' · Trước tuần đang xem'}</p>
    <p lang="en">{topic.lines[review.index]!.cue}</p>
    <p>Tự đánh giá · {review.grade === 2 ? 'Đã tự trả lời' : 'Cần gợi ý'}</p>
    {memo && <p className="journal-memo">{memo}</p>}
    {hasRecording ? <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Nghe lại bản ghi</summary>
      {open && <RecordingList topicId={review.itemId} limit={1} />}
    </details> : !memo && <p className="hint">Lượt này chỉ lưu tự đánh giá.</p>}
  </article>;
}
