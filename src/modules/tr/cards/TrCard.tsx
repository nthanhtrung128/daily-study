import { useMemo, useState, type ReactNode } from 'react';
import type { Grade } from '../../../core/leitner';
import { LEVEL_NAME, levelOf, type LeitnerState } from '../../../core/leitner';
import { fmt, isCorrect, parseNums } from '../../../core/num';
import { defaultRng, shuffle } from '../../../core/rng';
import { baiLabel, type Concept } from '../data';
import type { TrItem } from '../items';

/** Một thẻ trong phiên ôn TR: khái niệm, công thức, thuật ngữ, trắc nghiệm, bài tính, câu hỏi mở. */
export interface CardProps {
  it: TrItem;
  state: LeitnerState | undefined;
  /** Chấm điểm mục (ghi Leitner). */
  onGrade: (g: Grade) => void;
  /** Sang mục tiếp theo. */
  onNext: () => void;
  note?: string;
  onSaveNote?: (text: string) => void;
}

function Head({ it, state, label }: { it: TrItem; state: LeitnerState | undefined; label: string }) {
  return (
    <div className="kind">
      <span>{label}</span>
      <span>
        {baiLabel(it.bai)}
        {it.type !== 'calc' ? `${it.bai.length ? ' · ' : ''}${LEVEL_NAME[levelOf(state)]}` : ''}
      </span>
    </div>
  );
}

export function GradeRow({ onPick }: { onPick: (g: Grade) => void }) {
  return (
    <div className="grade" role="group" aria-label="Tự chấm">
      <button type="button" className="g0" onClick={() => onPick(0)}>
        Quên<small>ôn lại hôm nay</small>
      </button>
      <button type="button" className="g1" onClick={() => onPick(1)}>
        Mơ hồ<small>ôn lại ngày mai</small>
      </button>
      <button type="button" className="g2" onClick={() => onPick(2)}>
        Nhớ rõ<small>giãn lịch ôn</small>
      </button>
    </div>
  );
}

export function ConceptKv({ c }: { c: Concept }) {
  const rows: [string, string, string?][] = [
    ['Ý chính', c.dn],
    ['Công thức', c.ct, 'formula'],
    ['Ví dụ', c.vd],
    ['Nguồn', c.src],
  ];
  return (
    <dl className="kv">
      {rows
        .filter(([, v]) => v)
        .map(([k, v, cls]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd className={cls}>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/** Thẻ tự nhớ: mặt trước → nút lật → mặt sau + 3 nút chấm. */
function FlipCard({ head, front, back, flipLabel, grade, extra }: { head: ReactNode; front: ReactNode; back: ReactNode; flipLabel: string; grade: (g: Grade) => void; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      {head}
      {front}
      {extra}
      {open && <div className="back">{back}</div>}
      <div>
        {open ? (
          <GradeRow onPick={grade} />
        ) : (
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            {flipLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function NextBtn({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" className="btn" onClick={onNext} autoFocus>
        Câu tiếp
      </button>
    </div>
  );
}

function QuizCard({ it, state, onGrade, onNext }: CardProps & { it: Extract<TrItem, { type: 'quiz' }> }) {
  const q = it.q;
  const order = useMemo(() => shuffle(defaultRng, q.o.map((_, i) => i)), [q]);
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const right = picked === q.a;
  return (
    <div className="card">
      <Head it={it} state={state} label="Trắc nghiệm" />
      <div className="q">{q.q}</div>
      <div className="opts">
        {order.map((oi, k) => (
          <button
            key={oi}
            type="button"
            className={`opt${done && oi === q.a ? ' ok' : ''}${done && oi === picked && oi !== q.a ? ' no' : ''}`}
            disabled={done}
            onClick={() => {
              setPicked(oi);
              onGrade(oi === q.a ? 2 : 0);
            }}
          >
            <span className="k">{'ABCDEF'[k]}</span>
            <span>{q.o[oi]}</span>
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {done && (
          <>
            <div className={`fb ${right ? 'ok' : 'no'}`}>
              <b>{right ? 'Đúng. ' : 'Chưa đúng. '}</b>
              {q.ex}
            </div>
            <NextBtn onNext={onNext} />
          </>
        )}
      </div>
    </div>
  );
}

function CalcCard({ it, state, onGrade, onNext }: CardProps & { it: Extract<TrItem, { type: 'calc' }> }) {
  const c = it.calc;
  const P = useMemo(() => c.gen(defaultRng), [c]);
  const [val, setVal] = useState('');
  const [res, setRes] = useState<boolean | null>(null);
  const check = () => {
    if (!parseNums(val).length) return;
    const ok = isCorrect(val, P.ans, P.tol);
    setRes(ok);
    onGrade(ok ? 2 : 0);
  };
  return (
    <div className="card">
      <Head it={it} state={state} label={`Bài tính · ${c.name}${c.sup ? ' [Bổ sung]' : ''}`} />
      <div className="q">{P.q}</div>
      <div className="calc-in">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label="Đáp số"
          value={val}
          disabled={res !== null}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check();
          }}
        />
        <span className="unit">{P.unit}</span>
      </div>
      <div className="hint">
        {P.dec ? `Làm tròn ${P.dec} chữ số thập phân; dùng dấu phẩy hoặc dấu chấm đều được.` : 'Nhập số tròn, có thể viết 1.530.000 hoặc 1530000.'}
      </div>
      {res === null && (
        <div>
          <button type="button" className="btn" onClick={check}>
            Kiểm tra
          </button>
        </div>
      )}
      <div aria-live="polite">
        {res !== null && (
          <>
            <div className={`fb ${res ? 'ok' : 'no'}`}>
              <b>{res ? 'Đúng. ' : `Chưa đúng — đáp số ${fmt(P.ans, P.dec)} ${P.unit}. `}</b>
              {P.sol}
            </div>
            <NextBtn onNext={onNext} />
          </>
        )}
      </div>
    </div>
  );
}

function OpenCard({ it, state, onGrade, note = '', onSaveNote }: CardProps & { it: Extract<TrItem, { type: 'open' }> }) {
  const o = it.o;
  const [text, setText] = useState(note);
  const [saved, setSaved] = useState(false);
  return (
    <FlipCard
      head={<Head it={it} state={state} label={`Câu hỏi mở · ${o.grp}`} />}
      front={<div className="q">{o.q}</div>}
      extra={
        <textarea
          aria-label="Ý trả lời của bạn"
          placeholder="Gạch ý trả lời của bạn (không bắt buộc, chỉ lưu khi bạn bấm Lưu vào ghi chú)…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
        />
      }
      back={
        <>
          {o.hint ? (
            <div>
              <div className="eyebrow">Gợi ý</div>
              <div>{o.hint}</div>
            </div>
          ) : (
            <div className="hint">Câu hỏi thiết kế để tự đối chiếu với thực tế công ty bạn; không có đáp án cố định.</div>
          )}
          <div className="row">
            <button
              type="button"
              className="btn ghost small"
              disabled={!text.trim()}
              onClick={() => {
                onSaveNote?.(text.trim());
                setSaved(true);
              }}
            >
              Lưu vào ghi chú
            </button>
            {saved && <span className="hint">Đã lưu</span>}
          </div>
        </>
      }
      flipLabel="Xem gợi ý & tự chấm"
      grade={onGrade}
    />
  );
}

export function TrCard(props: CardProps) {
  const { it, state, onGrade, onNext } = props;
  const gradeAndNext = (g: Grade) => {
    onGrade(g);
    onNext();
  };
  switch (it.type) {
    case 'flash': {
      const c = it.c;
      return (
        <FlipCard
          head={<Head it={it} state={state} label={`Thẻ khái niệm · ${c.chude}`} />}
          front={
            <>
              <h2>{c.vi}</h2>
              {c.en && <div className="en">{c.en}</div>}
              <p className="hint">Tự nói định nghĩa{c.ct ? ', công thức' : ''} và một ví dụ rồi lật thẻ.</p>
            </>
          }
          back={<ConceptKv c={c} />}
          flipLabel="Lật thẻ"
          grade={gradeAndNext}
        />
      );
    }
    case 'formula':
      return (
        <FlipCard
          head={<Head it={it} state={state} label="Thẻ công thức" />}
          front={
            <>
              <h2>{it.f.name}</h2>
              <p className="hint">Viết ra công thức trước khi lật.</p>
            </>
          }
          back={
            <>
              <div className="formula">{it.f.f}</div>
              <div className="hint">Ví dụ: {it.f.ex}</div>
            </>
          }
          flipLabel="Lật thẻ"
          grade={gradeAndNext}
        />
      );
    case 'term':
      return (
        <FlipCard
          head={<Head it={it} state={state} label={`Thuật ngữ #${it.g.n}`} />}
          front={<h2>{it.g.en}</h2>}
          back={
            <>
              <div className="q">{it.g.vi}</div>
              {it.g.note && <div className="hint">Đối chiếu khóa học: {it.g.note}</div>}
            </>
          }
          flipLabel="Xem nghĩa"
          grade={gradeAndNext}
        />
      );
    case 'quiz':
      return <QuizCard {...props} it={it} />;
    case 'calc':
      return <CalcCard {...props} it={it} />;
    case 'open':
      return <OpenCard {...props} it={it} onGrade={gradeAndNext} />;
  }
}

/** Phần giải thích ở màn kết quả (mục quên/sai). */
export function Explain({ it }: { it: TrItem }) {
  switch (it.type) {
    case 'flash':
      return <ConceptKv c={it.c} />;
    case 'formula':
      return (
        <div>
          <div className="formula">{it.f.f}</div>
          <div className="hint">Ví dụ: {it.f.ex}</div>
        </div>
      );
    case 'term':
      return <div>{it.g.vi + (it.g.note ? ` — ${it.g.note}` : '')}</div>;
    case 'quiz':
      return (
        <div>
          <div>
            <b>Đáp án: </b>
            {it.q.o[it.q.a]}
          </div>
          <div className="hint">{it.q.ex}</div>
        </div>
      );
    case 'calc':
      return <div className="hint">Bài tính sinh số mới mỗi lần; ôn lại công thức trong tab Tra cứu → Công thức.</div>;
    case 'open':
      return <div>{it.o.hint || 'Tự đối chiếu với thực tế công ty bạn.'}</div>;
  }
}
