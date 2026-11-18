import { useState } from 'react';
import { setRoadmapReview } from '../../core/roadmapReview';
import { entryById, KIND_LABEL } from '../../modules/lookup';
import { useRoadmapReview } from '../../modules/tr/roadmapCards';
import { useProgress } from '../useProgress';
import { LookupDetail } from './LookupDetail';

export function RoadmapRelatedCards({ ids }: { ids: string[] }) {
  const queue = useRoadmapReview(useProgress());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string>();
  const [error, setError] = useState(false);

  async function change(id: string, queued: boolean) {
    setSaving(id);
    setError(false);
    try {
      await setRoadmapReview(id, queued);
    } catch {
      setError(true);
    } finally {
      setSaving(undefined);
    }
  }

  return (
    <section className="stack" aria-labelledby="related-cards-title">
      <h2 className="h-sec" id="related-cards-title">Thẻ liên quan</h2>
      <p className="hint">Mở thẻ để xem lại khái niệm hoặc công thức. Thẻ được chọn sẽ hiện trong lịch ôn ở trang Hôm nay.</p>
      <div className="stack">
        {ids.map((id) => {
          const entry = entryById(id);
          if (!entry) return null;
          const queued = queue?.some((item) => item.id === id) ?? false;
          return (
            <details className="item roadmap-card" key={id} onToggle={({ currentTarget }) => {
              const open = currentTarget.open;
              setExpanded((cards) => ({ ...cards, [id]: open }));
            }}>
              <summary>
                <span className="lk-head"><b>{entry.title}</b></span>
                <span className="tag">{KIND_LABEL[entry.kind]}</span>
              </summary>
              {expanded[id] && (
                <div className="body">
                  <LookupDetail e={entry} />
                  <div className="row">
                    <button type="button" className={queued ? 'btn ghost' : 'btn'} disabled={!queue || saving !== undefined}
                      onClick={() => void change(id, !queued)}>
                      {saving === id ? 'Đang lưu…' : queued ? 'Bỏ khỏi lịch ôn' : 'Đưa vào lịch ôn'}
                    </button>
                    <span className="hint" role="status">{queued ? 'Đã lên lịch' : ''}</span>
                  </div>
                </div>
              )}
            </details>
          );
        })}
      </div>
      {error && <p role="alert">Chưa lưu được lịch ôn. Hãy thử lại.</p>}
    </section>
  );
}
