import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '../../../core/db';
import { useProgress } from '../../../ui/useProgress';
import { EN_DURATIONS, enStats, planEnglish } from '../plan';
import { DICT_COUNT, planDictation } from '../dictation';
import { RP_DIALOGUES } from '../roleplay';
import { SAY_ITEMS, planSpeaking } from '../speech/sayItems';
import { SPEAKING_TOPICS } from '../speech/topics';
import { isDue } from '../../../core/leitner';
import type { EnView } from './EnglishScreen';
import '../english.css';

const PREFS_KEY = 'en.prefs';
interface EnPrefs {
  min: number;
}
const DEFAULT: EnPrefs = { min: 10 };

/** Khối "Tiếng Anh giao tiếp" trên trang Hôm nay: bắt đầu phiên thẻ từ / câu mẫu / shadowing. */
export function EnglishHome({ onStart }: { onStart: (v: EnView) => void }) {
  const p = useProgress();
  const [selectedPrefs, setPrefs] = useState<EnPrefs>();
  const prefs = selectedPrefs ?? DEFAULT;

  useEffect(() => {
    let live = true;
    void getSetting<EnPrefs>(PREFS_KEY, DEFAULT)
      .then((v) => live && setPrefs((current) => current ?? { ...DEFAULT, ...v }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const today = p.today();
  const ph = enStats(p.stateOf, today, 'phrase');
  const pt = enStats(p.stateOf, today, 'pattern');
  const phPlan = planEnglish('phrase', p.stateOf, today, { minutes: prefs.min, dry: true });
  const ptPlan = planEnglish('pattern', p.stateOf, today, { minutes: prefs.min, dry: true });

  const sayDue = SAY_ITEMS.filter((i) => isDue(p.stateOf(i.id), today)).length;
  const startSpeak = () => {
    const list = planSpeaking(p.stateOf, today, { count: prefs.min });
    if (list.length) onStart({ kind: 'speak', list, t0: Date.now() });
  };

  const startDictation = () => {
    const list = planDictation(p.stateOf, today);
    if (list.length) onStart({ kind: 'dictation', list, t0: Date.now() });
  };

  const start = (type: 'phrase' | 'pattern') => {
    const list = planEnglish(type, p.stateOf, today, { minutes: prefs.min });
    if (list.length) onStart({ kind: 'cards', type, list, t0: Date.now(), minutes: prefs.min });
  };

  return (
    <div className="panel stack en-home" aria-labelledby="h-en">
      <div>
        <div className="eyebrow">Ôn riêng · Tiếng Anh giao tiếp</div>
        <h2 id="h-en" className="h-page">
          Luyện nói công sở
        </h2>
      </div>
      <div className="stats">
        <div className="stat">
          <b className="num" data-testid="en-due">
            {ph.due + pt.due}
          </b>
          <span>thẻ EN đến hạn</span>
        </div>
        <div className="stat">
          <b className="num">
            {ph.learned}
            <small>/{ph.total}</small>
          </b>
          <span>cụm từ đã thuộc</span>
        </div>
        <div className="stat">
          <b className="num">
            {pt.learned}
            <small>/{pt.total}</small>
          </b>
          <span>câu mẫu đã thuộc</span>
        </div>
      </div>
      <div className="row" role="group" aria-label="Thời lượng tiếng Anh">
        {EN_DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            className="chip"
            aria-pressed={prefs.min === m}
            onClick={() => {
              const next = { ...prefs, min: m };
              setPrefs(next);
              void setSetting(PREFS_KEY, next).catch(() => undefined);
            }}
          >
            {`EN ${m} phút`}
          </button>
        ))}
      </div>
      <div className="en-go">
        <button type="button" className="btn en-go-btn" disabled={!phPlan.length} onClick={() => start('phrase')}>
          Thẻ từ
          <small>{phPlan.length ? `${phPlan.length} thẻ · ${ph.due} đến hạn` : 'Hết thẻ đến hạn'}</small>
        </button>
        <button type="button" className="btn en-go-btn" disabled={!ptPlan.length} onClick={() => start('pattern')}>
          Câu mẫu
          <small>{ptPlan.length ? `${ptPlan.length} câu · ${pt.due} đến hạn` : 'Hết câu đến hạn'}</small>
        </button>
        <button type="button" className="btn ghost en-go-btn" onClick={() => onStart({ kind: 'shadow', t0: Date.now() })}>
          Shadowing
          <small>Nghe từng câu, nhại theo</small>
        </button>
        <button type="button" className="btn en-go-btn" onClick={startSpeak}>
          Luyện nói
          <small>{`${prefs.min} câu · máy chấm từng từ${sayDue ? ` · ${sayDue} đến hạn` : ''}`}</small>
        </button>
        <button type="button" className="btn en-go-btn" onClick={() => onStart({ kind: 'roleplay', t0: Date.now() })}>
          Nhập vai
          <small>{`${RP_DIALOGUES.length} hội thoại · app đọc vai kia, bạn nói vai mình`}</small>
        </button>
        <button type="button" className="btn en-go-btn" onClick={startDictation}>
          Nghe chép
          <small>{`${DICT_COUNT} câu · nghe rồi gõ lại`}</small>
        </button>
        <button type="button" className="btn ghost en-go-btn" onClick={() => onStart({ kind: 'topics', t0: Date.now() })}>
          Đề nói 1 phút
          <small>{`${SPEAKING_TOPICS.length} đề · ghi âm, nghe lại`}</small>
        </button>
      </div>
      <p className="hint">Âm thanh và micro chỉ bật khi bạn bấm nút. Bản ghi âm chỉ lưu trên máy. Giọng đọc và tốc độ đổi trong Cài đặt.</p>
    </div>
  );
}
