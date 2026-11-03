import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ShadowPlayer } from '../player';
import type { Track } from '../tracks';
import { RATES, tts } from '../tts';
import { setTtsPrefs, useTtsPrefs } from '../useTts';
import { SayCheck } from './SayCheck';
import { speechRec } from '../speech/recognizer';

const fmtRate = (r: number) => `${String(r).replace('.', ',')}×`;

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} fill="currentColor" />
    </svg>
  );
}
const PLAY = 'M8 5v14l11-7z';
const PAUSE = 'M7 5h4v14H7zM13 5h4v14h-4z';
const PREV = 'M6 6h2v12H6zM9.5 12L18 18V6z';
const NEXT = 'M16 6h2v12h-2zM6 18l8.5-6L6 6z';

/**
 * Trình phát shadowing: phát từng câu, nghỉ để nhại, play/pause, câu trước/sau, lặp câu,
 * tốc độ 0,75/0,85/1×, ẩn/hiện chữ. Nhận một Track bất kỳ (câu mẫu hoặc hội thoại S7).
 */
export function ShadowPlayerView({ track }: { track: Track }) {
  const prefs = useTtsPrefs();
  const player = useMemo(() => new ShadowPlayer(track.lines, tts, { rate: prefs.rate, accent: prefs.accent }), [track]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = useSyncExternalStore(player.subscribe, player.getState, player.getState);
  useEffect(() => () => player.destroy(), [player]);
  useEffect(() => {
    player.accent = prefs.accent;
  }, [player, prefs.accent]);

  const line = player.line(s.index);
  const status = s.playing ? (s.phase === 'gap' ? 'Đến lượt bạn nhại lại…' : 'Đang đọc…') : s.ended ? 'Hết bài. Bấm phát để nghe lại từ đầu.' : 'Đã dừng.';

  return (
    <div className="card en-card shadow" aria-label={`Shadowing: ${track.title}`}>
      <div className="kind">
        <span>Shadowing · {track.title}</span>
        <span className="num" data-testid="sh-count">
          {s.index + 1}/{player.length}
        </span>
      </div>

      <div className="sh-line" data-hidden={!s.showText || undefined}>
        {line?.speaker && <span className="tag sh-spk">{line.speaker}</span>}
        {line?.label && <span className="tag">{line.label}</span>}
        {s.showText ? (
          <>
            <p className="q" lang="en" data-testid="sh-en">
              {line?.en}
            </p>
            <p className="hint">{line?.vi}</p>
          </>
        ) : (
          <p className="q sh-masked" data-testid="sh-en">
            Đã ẩn chữ — nghe và nhại theo.
          </p>
        )}
      </div>

      <p className="hint" aria-live="polite" data-testid="sh-status">
        {status}
      </p>


      <div className="sh-ctrl" role="group" aria-label="Điều khiển">
        <button type="button" className="btn ghost sh-btn" onClick={() => player.prev()} disabled={s.index === 0} aria-label="Câu trước">
          <Icon d={PREV} />
        </button>
        <button type="button" className="btn sh-btn sh-play" onClick={() => {
            speechRec.abort();
            player.toggle();
          }} aria-label={s.playing ? 'Tạm dừng' : 'Phát'} disabled={!tts.supported}>
          <Icon d={s.playing ? PAUSE : PLAY} />
        </button>
        <button type="button" className="btn ghost sh-btn" onClick={() => player.next()} disabled={s.index >= player.length - 1} aria-label="Câu sau">
          <Icon d={NEXT} />
        </button>
      </div>

      <div className="row sh-opts">
        <button type="button" className="chip" aria-pressed={s.repeat} onClick={() => player.toggleRepeat()}>
          Lặp câu
        </button>
        <button type="button" className="chip" aria-pressed={!s.showText} onClick={() => player.toggleText()}>
          Ẩn chữ
        </button>
      </div>
      <div className="row sh-opts" role="group" aria-label="Tốc độ">
        <span className="hint">Tốc độ</span>
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              className="chip"
              aria-pressed={s.rate === r}
              onClick={() => {
                player.setRate(r);
                setTtsPrefs({ rate: r });
              }}
            >
              {fmtRate(r)}
            </button>
          ))}
      </div>
      {!tts.supported && <p className="hint">Trình duyệt này không hỗ trợ đọc văn bản (speechSynthesis).</p>}
      {line && <SayCheck key={`${track.id}:${s.index}`} target={line.en} listen={false} onStart={() => player.pause()} />}

      <ol className="sh-list" aria-label="Danh sách câu">
        {track.lines.map((l, i) => (
          <li key={i}>
            <button type="button" aria-current={i === s.index ? 'true' : undefined} onClick={() => player.goTo(i)}>
              <span className="num">{i + 1}</span>
              <span lang="en">{s.showText ? `${l.speaker ? `${l.speaker}: ` : ''}${l.en}` : `Câu ${i + 1}`}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
