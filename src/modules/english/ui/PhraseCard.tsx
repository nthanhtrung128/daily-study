import { useState } from 'react';
import { LEVEL_NAME, levelOf, type Grade, type LeitnerState } from '../../../core/leitner';
import { GradeRow } from '../../tr/cards/TrCard';
import { TOPIC_VI, type Phrase } from '../content';
import type { CardDir } from '../plan';
import { SpeakButton } from './SpeakButton';
import { SayCheck } from './SayCheck';

export interface PhraseCardProps {
  ph: Phrase;
  dir: CardDir;
  state: LeitnerState | undefined;
  /** Câu tự đặt đã lưu. */
  note: string;
  onSaveNote: (text: string) => void;
  onGrade: (g: Grade) => void;
}

/** Thẻ từ 2 chiều: EN→VI (nhận diện) / VI→EN (nhớ chủ động), nghe phát âm, câu ví dụ, tự đặt câu. */
export function PhraseCard({ ph, dir, state, note, onSaveNote, onGrade }: PhraseCardProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note);
  const [saved, setSaved] = useState(false);
  const enFront = dir === 'en-vi';

  const enBlock = (
    <div className="en-say">
      <h2 lang="en">{ph.en}</h2>
      <SpeakButton text={ph.en} what={ph.en} />
    </div>
  );

  return (
    <div className="card en-card" data-dir={dir}>
      <div className="kind">
        <span>Thẻ từ · {enFront ? 'EN → VI' : 'VI → EN'}</span>
        <span>
          {TOPIC_VI[ph.topic]} · {ph.level} · {LEVEL_NAME[levelOf(state)]}
        </span>
      </div>
      {enFront ? (
        <>
          {enBlock}
          {ph.ipa && <div className="en">{ph.ipa}</div>}
          {!open && <p className="hint">Nghĩa là gì? Thử nói một câu có cụm này rồi lật thẻ.</p>}
        </>
      ) : (
        <>
          <h2>{ph.vi}</h2>
          {!open && <p className="hint">Nói to cụm tiếng Anh tương ứng rồi lật thẻ để đối chiếu.</p>}
        </>
      )}
      {open && (
        <div className="back">
          {enFront ? <div className="en-mean">{ph.vi}</div> : enBlock}
          <div>
            <div className="eyebrow">Ví dụ</div>
            <div className="en-ex">
              <p lang="en">{ph.example}</p>
              <SpeakButton text={ph.example} label="Nghe câu" what={ph.example} />
            </div>
            <SayCheck target={ph.example} listen={false} />
          </div>
          {ph.note && <p className="hint">{ph.note}</p>}
          <div className="field">
            <label className="eyebrow" htmlFor={`own-${ph.id}`}>
              Tự đặt câu
            </label>
            <textarea
              id={`own-${ph.id}`}
              lang="en"
              autoCapitalize="sentences"
              placeholder={`Viết một câu của bạn có “${ph.en}”…`}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSaved(false);
              }}
            />
            <div className="row">
              <button
                type="button"
                className="btn ghost small"
                disabled={text.trim() === note.trim() && !saved}
                onClick={() => {
                  onSaveNote(text.trim());
                  setSaved(true);
                }}
              >
                Lưu câu
              </button>
              {text.trim() && <SpeakButton text={text} label="Nghe câu của bạn" />}
              <span className="hint" aria-live="polite">
                {saved ? 'Đã lưu trên máy.' : ''}
              </span>
            </div>
          </div>
        </div>
      )}
      <div>
        {open ? (
          <GradeRow onPick={onGrade} />
        ) : (
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            Lật thẻ
          </button>
        )}
      </div>
    </div>
  );
}
