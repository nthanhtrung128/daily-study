import { useEffect, useState } from 'react';
import { db } from '../../core/db';
import { caseDraftKeys, draftEnvelope, DraftChanged, emptyEquity, emptyOffers, type CaseId, writeCaseDraft } from '../../core/caseDraft';

export function useCaseDraft<T extends typeof emptyEquity | typeof emptyOffers>(id: CaseId, blank: T, read: (v: unknown) => T | undefined) {
  const [fields, setFields] = useState(blank);
  const [version, setVersion] = useState<string>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState('');
  useEffect(() => {
    let live = true;
    void db.settings.get(caseDraftKeys[id]).then((row) => {
      if (!live) return;
      const entry = draftEnvelope(row?.value);
      setVersion(entry?.version);
      setFields(read(entry?.fields) ?? blank);
      setStatus('ready');
    }, () => { if (live) setStatus('failed'); });
    return () => { live = false; };
  }, [id, blank, read]);
  function edit(patch: Partial<T>) { setFields((current) => ({ ...current, ...patch })); }
  function reset() { setFields(blank); setVersion(undefined); setDraftError(''); }
  async function pause() {
    setSavingDraft(true); setDraftError('');
    try {
      await writeCaseDraft(id, fields, version);
      window.location.hash = '#hom-nay';
    } catch (e) {
      setDraftError(e instanceof DraftChanged ? 'Bản nháp đã thay đổi ở cửa sổ khác. Sao lại phần vừa nhập rồi tải lại để xem bản mới.' : 'Chưa lưu được bản nháp. Hãy thử lại.');
      setSavingDraft(false);
    }
  }
  return { fields, edit, status, version, pause, reset, draftError, savingDraft };
}
