import { useDeferredValue, useMemo, useState } from 'react';
import { LEVEL_NAME, levelOf, type Grade } from '../../core/leitner';
import { BAI_KEYS, BAI_SHORT } from '../../modules/tr/data';
import { KINDS, KIND_LABEL, NO_BAI, lookupIndex, search, type LookupEntry, type LookupKind, type LookupQuery } from '../../modules/lookup';
import { LookupDetail } from '../components/LookupDetail';
import { useProgress } from '../useProgress';

const PAGE = 60;
const BAI_FILTER = [...BAI_KEYS, 'Đọc thêm'] as const;
const baiChipLabel = (k: string) => (k === 'Bổ sung' ? 'Pháp lý VN' : k === 'Đọc thêm' ? 'Đọc thêm' : `Buổi ${BAI_SHORT[k] ?? k}`);

/** Giữ từ khóa và bộ lọc khi chuyển tab rồi quay lại (trong phiên mở app). */
let remembered: LookupQuery = { q: '', kind: '', bai: '' };

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

export function LookupPage() {
  const [query, setQuery] = useState<LookupQuery>(remembered);
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(query);
  const index = lookupIndex();
  const rows = useMemo(() => search(index, deferred), [index, deferred]);

  const update = (patch: Partial<LookupQuery>) => {
    const next = { ...query, ...patch };
    remembered = next;
    setQuery(next);
    setLimit(PAGE);
  };
  const showBai = !query.kind || !NO_BAI.has(query.kind);

  return (
    <section className="stack" aria-labelledby="h-lookup">
      <div className="panel stack">
        <h1 id="h-lookup" className="h-page">
          Tra cứu
        </h1>
        <label className="field">
          <span className="eyebrow">Tìm khái niệm, thuật ngữ, công thức, cụm từ</span>
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="vd: compa-ratio, phu cap, merit…"
            value={query.q}
            onChange={(e) => update({ q: e.target.value })}
          />
        </label>
        <div className="row" role="group" aria-label="Loại">
          <Chip pressed={!query.kind} onClick={() => update({ kind: '' })}>
            Tất cả
          </Chip>
          {KINDS.map((k) => (
            <Chip key={k} pressed={query.kind === k} onClick={() => update({ kind: query.kind === k ? '' : k })}>
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
        {showBai && (
          <div className="row" role="group" aria-label="Buổi">
            <Chip pressed={!query.bai} onClick={() => update({ bai: '' })}>
              Mọi buổi
            </Chip>
            {BAI_FILTER.map((k) => (
              <Chip key={k} pressed={query.bai === k} onClick={() => update({ bai: query.bai === k ? '' : k })}>
                {baiChipLabel(k)}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <p className="hint" data-testid="lk-count" aria-live="polite">
        {rows.length} kết quả
        {query.bai && !query.kind ? ' · lọc theo buổi chỉ áp cho mục TR101' : ''}
      </p>
      <div className="results">
        {rows.slice(0, limit).map((e) => (
          <LookupItem key={e.id} e={e} />
        ))}
      </div>
      {rows.length > limit && (
        <button type="button" className="btn ghost" onClick={() => setLimit(limit + PAGE)}>
          Xem thêm {Math.min(PAGE, rows.length - limit)} kết quả
        </button>
      )}
      {!rows.length && <p className="hint">Không có mục nào khớp. Thử bỏ dấu, gõ ít từ hơn hoặc chọn “Tất cả”.</p>}
    </section>
  );
}

const KIND_SHORT: Record<LookupKind, string> = {
  concept: 'KN',
  formula: 'CT',
  term: 'TN',
  open: 'Mở',
  quiz: 'TrN',
  phrase: 'EN',
  pattern: 'EN',
};

function LookupItem({ e }: { e: LookupEntry }) {
  const p = useProgress();
  const [open, setOpen] = useState(false);
  const state = p.stateOf(e.id);
  const lvl = levelOf(state);
  return (
    <details className="item" onToggle={(ev) => setOpen((ev.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <i className={`lvl l${lvl}`} title={LEVEL_NAME[lvl]} aria-label={LEVEL_NAME[lvl]} role="img" />
        <span className="lk-head">
          <b>{e.title}</b>
          {e.sub && <span className={e.kind === 'concept' || e.kind === 'formula' ? 'en' : 'sub'}>{e.sub}</span>}
        </span>
        <span className="tag" title={KIND_LABEL[e.kind]}>
          {e.kind === 'concept' || e.kind === 'phrase' || e.kind === 'pattern' ? e.tag : `${KIND_SHORT[e.kind]} · ${e.tag}`}
        </span>
      </summary>
      {open && (
        <div className="body">
          <LookupDetail e={e} />
          <LevelBlock id={e.id} />
          <NoteBox id={e.id} />
        </div>
      )}
    </details>
  );
}

const vnDay = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

function LevelBlock({ id }: { id: string }) {
  const p = useProgress();
  const s = p.stateOf(id);
  const [msg, setMsg] = useState('');
  const today = p.today();
  const grade = (g: Grade) => {
    const next = p.grade(id, g);
    setMsg(`Đã chấm: ${['Quên', 'Mơ hồ', 'Nhớ rõ'][g]} → hộp ${next.box}, ${next.due <= today ? 'ôn lại hôm nay' : `ôn lại ${vnDay(next.due)}`}.`);
  };
  return (
    <div className="lk-level">
      <div className="hint">
        Mức thuộc: <b className="lk-lvl-name">{LEVEL_NAME[levelOf(s)]}</b>
        {s?.box ? ` · hộp ${s.box}/5 · đến hạn ${s.due <= today ? 'hôm nay' : vnDay(s.due)}` : ''}
        {s?.wrong ? ` · sai ${s.wrong} lần` : ''}
      </div>
      <div className="grade" role="group" aria-label="Chấm mức thuộc">
        <button type="button" className="g0" onClick={() => grade(0)}>
          Quên<small>ôn lại hôm nay</small>
        </button>
        <button type="button" className="g1" onClick={() => grade(1)}>
          Mơ hồ<small>ôn lại ngày mai</small>
        </button>
        <button type="button" className="g2" onClick={() => grade(2)}>
          Nhớ rõ<small>giãn lịch ôn</small>
        </button>
      </div>
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

function NoteBox({ id }: { id: string }) {
  const p = useProgress();
  const saved = p.note(id);
  const [text, setText] = useState(saved);
  const [status, setStatus] = useState('');
  const save = () => {
    if (text.trim() === saved.trim()) return;
    p.setNote(id, text.trim());
    setStatus(text.trim() ? 'Đã lưu ghi chú' : 'Đã xóa ghi chú');
  };
  return (
    <div className="field">
      <span className="eyebrow">Ghi chú của bạn</span>
      <textarea
        aria-label="Ghi chú"
        placeholder="Ghi chú cho mục này… (tự lưu khi rời ô)"
        value={text}
        onChange={(ev) => {
          setText(ev.target.value);
          setStatus('');
        }}
        onBlur={save}
      />
      <span className="row">
        <button type="button" className="btn ghost small" onClick={save} disabled={text.trim() === saved.trim()}>
          Lưu ghi chú
        </button>
        <span className="hint" role="status">
          {status}
        </span>
      </span>
    </div>
  );
}
