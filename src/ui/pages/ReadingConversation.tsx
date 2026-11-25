import { useLayoutEffect, useRef, useState } from 'react';
import { freshConversation, saveConversation, type ConversationProgress } from '../../core/readingConversation';
import { SpeakButton } from '../../modules/english/ui/SpeakButton';
import { useTtsLifecycle } from '../../modules/english/useTts';
import { tts } from '../../modules/english/tts';
import { useFocusOnMount } from '../useFocusOnMount';

type Turn = { cue: string; task: string; model: string; meaning: string; check: string };

export function ReadingConversation({ articleId, turns, progress, jumpToTurn, onPause }: {
  articleId: string;
  turns: Turn[];
  progress: ConversationProgress | null | undefined;
  jumpToTurn: boolean;
  onPause: () => void;
}) {
  const [temporary, setTemporary] = useState<ConversationProgress>();
  const [revealedAt, setRevealedAt] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const current = temporary ?? progress ?? freshConversation;
  const step = current.scores.length;
  const turn = turns[step];
  const ready = progress !== undefined;
  const onThisPageOnly = !!temporary || progress === null;
  const revealed = revealedAt === current.at;
  const heading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef(jumpToTurn);
  const model = useFocusOnMount<HTMLParagraphElement>(revealed);
  useLayoutEffect(() => {
    if (ready && focusNext.current) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'center' });
      focusNext.current = false;
    }
  }, [ready, current.at]);
  useTtsLifecycle();

  async function advance(mark: boolean | 'restart') {
    if (saving) return;
    tts.cancel();
    focusNext.current = true;
    setSaving(true);
    setChangedElsewhere(false);
    const practiceHere = () => setTemporary({
      at: current.at + 1, scores: mark === 'restart' ? [] : [...current.scores, mark],
    });
    try {
      if (onThisPageOnly) practiceHere();
      else setChangedElsewhere(!await saveConversation(articleId, current.at, mark));
    } catch {
      practiceHere();
    } finally {
      setRevealedAt(undefined);
      setSaving(false);
    }
  }

  return <section className="roadmap-review stack" aria-label="Từ bài đọc đến hội thoại">
    <h2 className="h-sec">Từ bài đọc đến hội thoại</h2>
    {!ready ? <p role="status">Đang mở lượt luyện…</p> : <>
      <h3 ref={heading} tabIndex={-1}>{turn ? 'Lượt ' + (step + 1) + '/' + turns.length : 'Kết quả tự đánh giá'}</h3>
      {onThisPageOnly ? <p role="alert">Bộ nhớ trên máy chưa sẵn sàng. Bạn vẫn có thể luyện đến hết, các lượt chấm mới chỉ được giữ khi bài đang mở.</p>
        : step > 0 && <p className="hint" role="status">Đã lưu {step}/{turns.length} lượt tự chấm trên máy.</p>}
      {changedElsewhere && <p role="status">Tiến độ đã thay đổi ở cửa sổ khác. Bạn đang xem lượt mới nhất.</p>}
      {turn ? <>
        <p lang="en">{turn.cue}</p><div className="row"><SpeakButton text={turn.cue} label="Nghe lời đồng nghiệp" /></div>
        <p>{turn.task} Nói thành tiếng bằng tiếng Anh.</p>
        {revealed ? <>
          <p lang="en" ref={model} tabIndex={-1}>{turn.model}</p><p>{turn.meaning}</p><p><strong>Tự kiểm</strong> · {turn.check}</p>
          <div className="row"><button className="btn" disabled={saving} onClick={() => void advance(true)}>Tôi đã làm được</button>
            <button className="btn ghost" disabled={saving} onClick={() => void advance(false)}>Cần luyện thêm</button></div>
        </> : <button className="btn" onClick={() => setRevealedAt(current.at)}>Đã nói · Xem câu gợi ý</button>}
      </> : <>
        <p>Bạn tự đánh giá đạt {current.scores.filter(Boolean).length}/{turns.length} tiêu chí trong lượt này.</p>
        <ul>{turns.map((t, i) => <li key={t.cue}>{current.scores[i] ? 'Đã làm được' : 'Cần luyện thêm'} · {t.check}</li>)}</ul>
        <button className="btn ghost" disabled={saving} onClick={() => void advance('restart')}>Luyện lại ba lượt</button>
      </>}
      {!onThisPageOnly && step > 0 && <a className="reading-result-link" href="#doc-them" onClick={turn ? onPause : undefined}>
        {turn ? 'Tạm dừng · Về thư viện' : 'Về thư viện bài đọc'}
      </a>}
    </>}
  </section>;
}
