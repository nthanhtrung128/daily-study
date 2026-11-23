import type { CaseAttempt } from './caseAttempts';

export function CaseEvidence({ attempt, labels }: { attempt: CaseAttempt; labels: string[] }) {
  return <div className="stack"><p className="case-response">{attempt.response}</p>
    <ul>{labels.map((s, i) => <li key={s}>{s} · {attempt.criteria[i] ? 'Đạt' : 'Cần luyện'}</li>)}</ul></div>;
}
