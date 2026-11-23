import { useEffect, useRef, useState } from 'react';
import { SpeakButton } from '../../modules/english/ui/SpeakButton';
import { useTtsLifecycle } from '../../modules/english/useTts';
import { tts } from '../../modules/english/tts';

type Turn = { cue: string; task: string; model: string; meaning: string; check: string };

export function ReadingConversation({ turns }: { turns: Turn[] }) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<boolean[]>([]);
  const [revealed, setRevealed] = useState(false);
  const turn = turns[step];
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);
  useTtsLifecycle();
  function advance(ok: boolean) {
    tts.cancel();
    setScores([...scores, ok]);
    setRevealed(false);
    setStep(step + 1);
  }
  return <section className="roadmap-review stack" aria-label="Từ bài đọc đến hội thoại">
    <h2 className="h-sec">Từ bài đọc đến hội thoại</h2>
    <h3 ref={heading} tabIndex={-1} key={step}>{turn ? 'Lượt ' + (step + 1) + '/' + turns.length : 'Kết quả tự đánh giá'}</h3>
    {turn ? <>
      <p lang="en">{turn.cue}</p><div className="row"><SpeakButton text={turn.cue} label="Nghe lời đồng nghiệp" /></div>
      <p>{turn.task} Nói thành tiếng bằng tiếng Anh.</p>
      {revealed ? <>
        <p lang="en">{turn.model}</p><p>{turn.meaning}</p><p><strong>Tự kiểm</strong> · {turn.check}</p>
        <div className="row"><button className="btn" onClick={() => advance(true)}>Tôi đã làm được</button>
          <button className="btn ghost" onClick={() => advance(false)}>Cần luyện thêm</button></div>
      </> : <button className="btn" onClick={() => setRevealed(true)}>Đã nói · Xem câu gợi ý</button>}
    </> : <>
      <p>Bạn tự đánh giá đạt {scores.filter(Boolean).length}/{turns.length} tiêu chí trong lượt này.</p>
      <ul>{turns.map((t, i) => <li key={t.cue}>{scores[i] ? 'Đã làm được' : 'Cần luyện thêm'} · {t.check}</li>)}</ul>
      <button className="btn ghost" onClick={() => { setStep(0); setScores([]); }}>Luyện lại ba lượt</button>
    </>}
  </section>;
}
