import { say } from '../useTts';
import { tts } from '../tts';

export function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Nút nghe phát âm. Âm thanh chỉ bắt đầu khi bấm (yêu cầu của iOS Safari). */
export function SpeakButton({ text, label = 'Nghe', what }: { text: string; label?: string; what?: string }) {
  const ok = tts.supported;
  return (
    <button
      type="button"
      className="btn ghost say"
      onClick={() => say(text)}
      disabled={!ok}
      aria-label={`${label}${what ? `: ${what}` : ''}`}
      title={ok ? undefined : 'Trình duyệt này không hỗ trợ đọc văn bản'}
    >
      <SpeakerIcon />
      <span>{label}</span>
    </button>
  );
}
