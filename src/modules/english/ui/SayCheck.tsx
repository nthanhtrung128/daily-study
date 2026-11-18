import { useEffect, useRef, useState } from 'react';
import type { Grade } from '../../../core/leitner';
import { REC_ERROR_VI, speechRec, type RecErrorCode } from '../speech/recognizer';
import { missStore } from '../../../core/misswords';
import { GRADE_VI, bestOf, gradeForScore, scoreSpeech, type ScoreResult } from '../speech/score';
import { useRecState } from '../speech/useRec';
import { tts } from '../tts';
import { SpeakButton } from './SpeakButton';
import '../speech.css';

export function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_VI = { ok: 'đúng', wrong: 'sai', missing: 'thiếu' } as const;

/** Câu đích tô màu từng từ: đúng / sai (kèm từ nghe được) / thiếu, và từ thừa. */
export function WordDiff({ r }: { r: ScoreResult }) {
  return (
    <p className="say-diff" lang="en" data-testid="say-diff">
      {r.words.map((w, i) => (
        <span key={i} className="say-wd">
          {w.extraBefore?.map((x, k) => (
            <ins key={k} className="w-extra" data-status="extra">
              +{x}
              <span className="say-sr"> (thừa)</span>
            </ins>
          ))}
          <span className={`w-${w.status}`} data-status={w.status} title={w.heard ? `Nghe thành: ${w.heard}` : STATUS_VI[w.status]}>
            {w.text}
            {w.status !== 'ok' && <span className="say-sr"> ({STATUS_VI[w.status]})</span>}
            {w.heard && <small className="w-heard">{w.heard}</small>}
          </span>{' '}
        </span>
      ))}
      {r.extraAfter.map((x, k) => (
        <ins key={`e${k}`} className="w-extra" data-status="extra">
          +{x}
          <span className="say-sr"> (thừa)</span>{' '}
        </ins>
      ))}
    </p>
  );
}

export interface SayCheckProps {
  /** Câu đích. */
  target: string;
  /** Hiện nút nghe câu mẫu (tắt khi thẻ đã có nút nghe riêng). */
  listen?: boolean;
  /** Gọi mỗi lần chấm xong. */
  onScored?: (r: ScoreResult, g: Grade) => void;
  /** Có thì hiện nút "Chấm theo điểm" (đưa vào Leitner). */
  onApply?: (g: Grade) => void;
  /** Gọi ngay khi bắt đầu nghe (vd dừng trình phát shadowing). */
  onStart?: () => void;
}

/**
 * Nói có chấm: bấm "Nói thử" → nhận giọng en-US → so từng từ với câu đích → tô màu + điểm %.
 * Không có nhận giọng (hoặc lỗi) thì cho gõ / đọc chính tả bằng bàn phím rồi chấm như thường.
 */
export function SayCheck({ target, listen = true, onScored, onApply, onStart }: SayCheckProps) {
  const s = useRecState();
  const [mine, setMine] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [err, setErr] = useState<RecErrorCode | null>(null);
  const [typed, setTyped] = useState('');
  const mineRef = useRef(false);
  const supported = speechRec.supported;

  useEffect(
    () => () => {
      if (mineRef.current) speechRec.abort();
    },
    [],
  );

  const scored = (r: ScoreResult) => {
    setResult(r);
    // Đếm từ nói sai / thiếu cho "Từ hay sai" (nói đúng thì giảm).
    missStore.record(r.words);
    onScored?.(r, gradeForScore(r.score));
  };

  const listening = mine && s.status !== 'idle';
  const toggle = () => {
    if (listening) {
      speechRec.stop();
      return;
    }
    tts.cancel(); // micro không thu tiếng máy đọc
    onStart?.();
    setErr(null);
    setResult(null);
    mineRef.current = true;
    setMine(true);
    // Gọi start ngay trong handler bấm (iOS).
    void speechRec.start({ lang: 'en-US' }).then((out) => {
      mineRef.current = false;
      setMine(false);
      if (out.aborted) return;
      if (out.error) {
        setErr(out.error);
        return;
      }
      scored(bestOf(target, out.alternatives.length ? out.alternatives : [out.transcript]));
    });
  };

  const live = listening ? [s.final, s.interim].filter(Boolean).join(' ') : '';
  const g = result ? gradeForScore(result.score) : null;
  const showTyping = !supported || !!err;

  return (
    <div className="say-check" data-testid="say-check">
      <div className="row">
        <button
          type="button"
          className={`btn say-mic${listening ? ' on' : ''}`}
          onClick={toggle}
          disabled={!supported || s.status === 'stopping'}
          aria-pressed={listening}
          title={supported ? undefined : 'Trình duyệt này không hỗ trợ nhận giọng nói'}
        >
          <MicIcon />
          <span>{listening ? (s.status === 'stopping' ? 'Đang chấm…' : 'Dừng') : result ? 'Nói lại' : 'Nói thử'}</span>
        </button>
        {listen && <SpeakButton text={target} label="Nghe mẫu" what={target} />}
      </div>

      <div aria-live="polite" className="say-live">
        {listening && (
          <p className="hint" data-testid="say-live">
            <span className="say-dot" aria-hidden="true" /> Đang nghe… {live && <q lang="en">{live}</q>}
          </p>
        )}
      </div>

      <p className="say-sr" role="status" aria-live="polite" data-testid="say-announce">
        {result && g !== null ? `Điểm ${result.score}%. ${GRADE_VI[g]}.` : ''}
      </p>

      {err && (
        <p className="say-err" role="alert" data-testid="say-err">
          {REC_ERROR_VI[err]}
        </p>
      )}
      {!supported && !err && <p className="hint">{REC_ERROR_VI.unsupported}</p>}

      {result && g !== null && (
        <div className="say-result" data-testid="say-result">
          <div className="say-score">
            <b className="num" data-testid="say-score" data-grade={g}>
              {result.score}%
            </b>
            <span>
              {g === 2 ? 'Rất tốt!' : g === 1 ? 'Khá — nói lại phần tô màu.' : 'Chưa khớp — nghe mẫu rồi thử lại.'}
              <br />
              <span className="hint">Gợi ý chấm: {GRADE_VI[g]}</span>
            </span>
          </div>
          <WordDiff r={result} />
          <p className="hint">
            Máy nghe được: <q lang="en">{result.transcript || '…'}</q>
          </p>
          <p className="say-legend hint" aria-hidden="true">
            <span className="w-ok">đúng</span> <span className="w-wrong">sai</span> <span className="w-missing">thiếu</span> <ins className="w-extra">+thừa</ins>
          </p>
          {onApply && (
            <button type="button" className="btn ghost" onClick={() => onApply(g)}>
              Chấm theo điểm · {GRADE_VI[g]}
            </button>
          )}
        </div>
      )}

      {showTyping && (
        <details className="say-type">
          <summary>Gõ hoặc đọc chính tả bằng bàn phím</summary>
          <div className="field">
            <textarea
              lang="en"
              aria-label="Câu bạn nói (gõ hoặc đọc chính tả)"
              placeholder="Bấm micro trên bàn phím iPhone và nói câu…"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
            <div className="row">
              <button type="button" className="btn ghost small" disabled={!typed.trim()} onClick={() => scored(scoreSpeech(target, typed))}>
                Chấm câu này
              </button>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
