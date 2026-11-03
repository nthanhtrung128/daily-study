import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultRng } from '../../../core/rng';
import { TOPIC_VI, type Topic } from '../content';
import { AudioRecorder, RecorderError, RECORDER_ERROR_VI } from '../speech/recorder';
import { REC_ERROR_VI, speechRec, type RecOutcome } from '../speech/recognizer';
import { saveRecording, fmtDur } from '../speech/recordings';
import { isQuotaError } from '../../../core/db';
import { useFocusOnMount } from '../../../ui/useFocusOnMount';
import { DURATIONS, SPEAKING_TOPICS, USING_FALLBACK_TOPICS, defaultSeconds, type SpeakingTopic } from '../speech/topics';
import { useRecLifecycle, useRecState } from '../speech/useRec';
import { tts } from '../tts';
import { MicIcon } from './SayCheck';
import { RecordingList } from './RecordingList';
import { SpeakButton } from './SpeakButton';
import '../speech.css';

/** Màn "Đề nói 1 phút": chọn đề → xem gợi ý → đếm ngược + ghi âm → nghe lại / xóa bản ghi. */
export function TopicScreen({ onExit }: { onExit: () => void }) {
  useRecLifecycle();
  const [topic, setTopic] = useState<SpeakingTopic | null>(null);
  const [filter, setFilter] = useState<Topic | null>(null);
  const topics = SPEAKING_TOPICS;
  const present = useMemo(() => [...new Set(topics.map((t) => t.topic))], [topics]);
  const shown = filter ? topics.filter((t) => t.topic === filter) : topics;

  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [topic]);

  return (
    <section className="stack en-screen" aria-labelledby="h-topic">
      <div className="sess-top">
        <h1 id="h-topic" className="h-page sh-title">
          Đề nói 1 phút
        </h1>
        {topic && (
          <button type="button" className="btn ghost small" onClick={() => setTopic(null)}>
            Chọn đề
          </button>
        )}
        <button type="button" className="btn ghost small" onClick={onExit}>
          Xong
        </button>
      </div>
      {topic ? (
        <TopicRecorder key={topic.id} topic={topic} />
      ) : (
        <>
          <p className="hint">
            Chọn một đề, đọc gợi ý rồi bấm ghi âm và nói liền một mạch đến hết giờ. Nghe lại để tự sửa.
            {USING_FALLBACK_TOPICS ? ` Đang dùng ${topics.length} đề mẫu; bộ đề đầy đủ sẽ được bổ sung.` : ` ${topics.length} đề.`}
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={() => setTopic(shown[Math.floor(defaultRng() * shown.length)] ?? null)} disabled={!shown.length}>
              Đề ngẫu nhiên
            </button>
          </div>
          <div className="eyebrow">Bản ghi gần đây</div>
          <RecordingList showTitle limit={3} />
          <div className="eyebrow">Chọn đề</div>
          {present.length > 1 && (
            <div className="row" role="group" aria-label="Lọc theo chủ đề">
              <button type="button" className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
                Tất cả
              </button>
              {present.map((t) => (
                <button key={t} type="button" className="chip" aria-pressed={filter === t} onClick={() => setFilter(t)}>
                  {TOPIC_VI[t]}
                </button>
              ))}
            </div>
          )}
          <div className="sh-tracks">
            {shown.map((t) => (
              <button key={t.id} type="button" className="opt" onClick={() => setTopic(t)}>
                <span>
                  <b lang="en">{t.en}</b>
                  <br />
                  <span className="hint">
                    {TOPIC_VI[t.topic]} · {t.level} · {t.vi}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

type Phase = 'idle' | 'requesting' | 'recording' | 'saving';

export function TopicRecorder({ topic }: { topic: SpeakingTopic }) {
  const [secs, setSecs] = useState(() => defaultSeconds(topic));
  const [withText, setWithText] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(secs * 1000);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  // Đếm ngược cho trình đọc màn hình: chỉ báo các mốc (không đọc mỗi giây).
  const [announce, setAnnounce] = useState('');
  const lastMark = useRef(0);
  const cardRef = useFocusOnMount<HTMLDivElement>();
  const rs = useRecState();
  const recorder = useMemo(() => new AudioRecorder(), []);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recP = useRef<Promise<RecOutcome> | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const setP = (ph: Phase) => {
    phaseRef.current = ph;
    setPhase(ph);
  };

  const clearTick = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const finish = useCallback(async () => {
    if (phaseRef.current !== 'recording') return;
    clearTick();
    setP('saving');
    const rp = recP.current;
    recP.current = null;
    if (rp) speechRec.stop();
    try {
      const res = await recorder.stop();
      const out = rp ? await rp : null;
      if (out?.error && out.error !== 'no-speech') setErr(`Đã ghi âm, nhưng không nhận được chữ: ${REC_ERROR_VI[out.error]}`);
      await saveRecording({ topicId: topic.id, title: topic.en, blob: res.blob, ms: res.ms, mime: res.mime, ...(out?.transcript ? { transcript: out.transcript } : {}) });
      const msg = `Đã lưu bản ghi ${fmtDur(res.ms)} trên máy.`;
      setSaved(msg);
      setAnnounce(msg);
      setRefresh((x) => x + 1);
    } catch (e) {
      setErr(
        isQuotaError(e)
          ? 'Bộ nhớ máy đã đầy nên không lưu được bản ghi. Xóa bớt bản ghi cũ bên dưới hoặc giải phóng dung lượng iPhone rồi thử lại.'
          : 'Không lưu được bản ghi (trình duyệt chặn lưu trữ, vd Duyệt web riêng tư).',
      );
    }
    setP('idle');
  }, [recorder, topic]);

  // Ẩn app khi đang ghi (iOS cắt micro) hoặc rời màn (đổi tab, bấm Xong / Chọn đề): dừng ghi, giải phóng micro
  // và lưu phần đã ghi. Đang chờ quyền micro thì hủy.
  useEffect(() => {
    const vis = () => {
      if (document.visibilityState === 'hidden') void finish();
    };
    const hide = () => void finish();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', hide);
      clearTick();
      if (phaseRef.current === 'recording') void finish();
      else if (phaseRef.current !== 'saving') {
        recorder.cancel();
        speechRec.abort();
      }
    };
  }, [finish, recorder]);

  const start = () => {
    tts.cancel();
    setErr(null);
    setSaved(null);
    setLeft(secs * 1000);
    lastMark.current = secs;
    // Cả hai gọi ngay trong handler bấm: getUserMedia (xin quyền micro) và nhận giọng (nếu bật).
    const p = recorder.start();
    recP.current = withText && speechRec.supported ? speechRec.start({ lang: 'en-US', keepAlive: true }) : null;
    setP('requesting');
    p.then(() => {
      setP('recording');
      setAnnounce(`Bắt đầu ghi âm, ${secs} giây. Nói đi.`);
      timer.current = setInterval(() => {
        const l = secs * 1000 - recorder.elapsed();
        setLeft(Math.max(0, l));
        const s = Math.ceil(l / 1000);
        const mark = [30, 20, 10, 5].find((m) => s <= m && m < lastMark.current);
        if (mark !== undefined && l > 0) {
          lastMark.current = mark;
          setAnnounce(`Còn ${mark} giây.`);
        }
        if (l <= 0) {
          setAnnounce('Hết giờ.');
          void finish();
        }
      }, 200);
    }).catch((e: unknown) => {
      speechRec.abort();
      recP.current = null;
      setErr(e instanceof RecorderError ? RECORDER_ERROR_VI[e.code] : RECORDER_ERROR_VI.other);
      setP('idle');
    });
  };

  const busy = phase !== 'idle';
  const leftS = Math.ceil(left / 1000);
  const pct = Math.max(0, Math.min(100, (1 - left / (secs * 1000)) * 100));
  const live = withText ? [rs.final, rs.interim].filter(Boolean).join(' ') : '';

  return (
    <div className="stack">
      <div className="card en-card" ref={cardRef} tabIndex={-1}>
        <div className="kind">
          <span>
            Đề nói · {TOPIC_VI[topic.topic]} · {topic.level}
          </span>
        </div>
        <h2 lang="en" data-testid="topic-en">
          {topic.en}
        </h2>
        <p className="hint">{topic.vi}</p>
        <div className="row">
          <SpeakButton text={topic.en} label="Nghe đề" what={topic.en} />
        </div>
        <div>
          <div className="eyebrow">Gợi ý</div>
          <ul className="topic-hints" lang="en">
            {topic.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
        {!!topic.useful?.length && (
          <div>
            <div className="eyebrow">Cụm nên dùng</div>
            <div className="row topic-useful" lang="en">
              {topic.useful.map((u, i) => (
                <span key={i} className="tag">
                  {u}
                </span>
              ))}
            </div>
          </div>
        )}
        {topic.opener && (
          <div>
            <div className="eyebrow">Câu mở đầu mẫu</div>
            <div className="en-ex">
              <p lang="en">{topic.opener}</p>
              <SpeakButton text={topic.opener} label="Nghe câu mở đầu" what={topic.opener} />
            </div>
          </div>
        )}
        <div className="row" role="group" aria-label="Thời gian nói">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className="chip"
              aria-pressed={secs === d}
              disabled={busy}
              onClick={() => {
                setSecs(d);
                setLeft(d * 1000);
              }}
            >
              {d} giây
            </button>
          ))}
        </div>
        {speechRec.supported && (
          <div className="row">
            <button type="button" className="chip" aria-pressed={withText} disabled={busy} onClick={() => setWithText(!withText)}>
              Kèm chữ (nhận giọng, thử nghiệm)
            </button>
          </div>
        )}

        <div className="rec-box" data-phase={phase}>
          <div className="rec-clock num" data-testid="rec-left" aria-live="off">
            {fmtDur(leftS * 1000)}
          </div>
          <div className="bar rec-bar" role="progressbar" aria-label="Thời gian đã nói" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <i style={{ width: `${pct}%` }} />
          </div>
          {phase === 'recording' || phase === 'saving' ? (
            <button type="button" className="btn rec-btn on" onClick={() => void finish()} disabled={phase === 'saving'}>
              <span className="say-dot" aria-hidden="true" /> {phase === 'saving' ? 'Đang lưu…' : 'Dừng & lưu'}
            </button>
          ) : (
            <button type="button" className="btn rec-btn" onClick={start} disabled={phase === 'requesting' || !recorder.supported}>
              <MicIcon /> {phase === 'requesting' ? 'Đang mở micro…' : 'Bắt đầu ghi âm'}
            </button>
          )}
          <p className="sr-only" role="status" aria-live="polite" data-testid="rec-announce">
            {announce}
          </p>
          <p className="hint" data-testid="rec-status">
            {phase === 'recording' ? `Đang ghi âm — còn ${leftS} giây.` : phase === 'requesting' ? 'Cho phép dùng micro nếu máy hỏi.' : (saved ?? '')}
          </p>
          {live && (
            <p className="hint" lang="en">
              {live}
            </p>
          )}
        </div>
        {!recorder.supported && <p className="say-err">{RECORDER_ERROR_VI.unsupported}</p>}
        {err && (
          <p className="say-err" role="alert" data-testid="rec-err">
            {err}
          </p>
        )}
      </div>
      <div className="eyebrow">Bản ghi của đề này</div>
      <RecordingList topicId={topic.id} refresh={refresh} />
    </div>
  );
}
