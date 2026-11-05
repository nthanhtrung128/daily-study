import { useState } from 'react';
import { LEVEL_NAME, levelOf, type Grade, type LeitnerState } from '../../../core/leitner';
import { GradeRow } from '../../tr/cards/TrCard';
import { TOPIC_VI, type Pattern } from '../content';
import { applySlots, optionText, segments } from '../slots';
import { SpeakButton } from './SpeakButton';
import { SayCheck } from './SayCheck';
import { useFocusOnMount } from '../../../ui/useFocusOnMount';

export interface PatternCardProps {
  pt: Pattern;
  state: LeitnerState | undefined;
  onGrade: (g: Grade) => void;
}

/** Câu mẫu: (1) nghe → (2) nhại → (3) tự thay từ ở các slot, nghe lại câu đã thay, rồi tự chấm. */
export function PatternCard({ pt, state, onGrade }: PatternCardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<number[]>(() => pt.slots.map(() => -1));
  const segs = segments(pt.en, pt.slots, step === 2 ? choice : []);
  const current = applySlots(pt.en, pt.slots, choice);
  const pick = (k: number, c: number) => setChoice((prev) => prev.map((x, i) => (i === k ? c : x)));
  const cardRef = useFocusOnMount<HTMLDivElement>();
  const slotsRef = useFocusOnMount<HTMLDivElement>(step === 2);

  return (
    <div className="card en-card" ref={cardRef} tabIndex={-1}>
      <div className="kind">
        <span>Câu mẫu · {pt.situation}</span>
        <span>
          {TOPIC_VI[pt.topic]} · {pt.level} · {LEVEL_NAME[levelOf(state)]}
        </span>
      </div>
      <ol className="en-steps" aria-label="Các bước">
        <li aria-current={step === 1 ? 'step' : undefined}>Nghe</li>
        <li aria-current={step === 1 ? 'step' : undefined}>Nhại</li>
        <li aria-current={step === 2 ? 'step' : undefined}>Tự thay từ</li>
      </ol>
      <p className="q en-sent" lang="en" data-testid="pt-sentence">
        {segs.map((s, i) =>
          s.slot === undefined ? (
            <span key={i}>{s.text}</span>
          ) : (
            <mark key={i} className={`slot${s.changed ? ' changed' : ''}`}>
              {s.text}
            </mark>
          ),
        )}
      </p>
      <p className="hint">{pt.vi}</p>

      {step === 1 ? (
        <>
          <div className="row">
            <SpeakButton text={pt.en} label="Nghe câu" what={pt.en} />
          </div>
          <p className="hint">Nghe rồi nhại lại 2–3 lần, bắt chước nhịp và ngữ điệu. Phần tô màu là chỗ sẽ tự thay từ.</p>
          <SayCheck target={pt.en} listen={false} />
          <div className="card-act">
            <button type="button" className="btn" onClick={() => setStep(2)}>
              Đã nhại · sang tự thay từ
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="en-slots" ref={slotsRef} tabIndex={-1} aria-label="Tự thay từ">
            {pt.slots.map((sl, k) => {
              const opts = [-1, ...sl.alts.map((_, i) => i)];
              return (
                <div key={k} className="row" role="group" aria-label={`Chỗ thay ${k + 1}`}>
                  {opts.map((c) => (
                    <button key={c} type="button" className="chip" lang="en" aria-pressed={(choice[k] ?? -1) === c} onClick={() => pick(k, c)}>
                      {optionText(sl, c)}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="row">
            <SpeakButton text={current} label="Nghe câu đã thay" what={current} />
          </div>
          {pt.note && <p className="hint">{pt.note}</p>}
          <p className="hint">Nói to câu đã thay (bấm “Nói thử” để máy chấm), rồi tự chấm: bạn nói câu này đã trôi chảy chưa?</p>
          <SayCheck key={current} target={current} listen={false} onApply={onGrade} />
          <div className="card-act">
            <GradeRow onPick={onGrade} />
          </div>
        </>
      )}
    </div>
  );
}
