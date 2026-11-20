import { useState } from 'react';
import { evaluateJob, evaluation } from './jobEvaluation';

export function JobEvaluationPractice() {
  const [selected, select] = useState(0);
  const [edits, setEdits] = useState<Record<string, number[]>>({});
  const profile = evaluation.profiles[selected]!;
  const levels = edits[profile.role] ?? profile.levels;
  const result = evaluateJob(levels);
  const baseline = evaluateJob(profile.levels);

  return <section className="stack roadmap-review" aria-labelledby="evaluation-title">
    <h2 className="h-sec" id="evaluation-title">Thử chấm điểm và xếp ngạch</h2>
    <p>Chọn một hồ sơ, đọc bằng chứng rồi thử thay đổi một cấp. Trong thang giả định này, điểm mỗi yếu tố bằng cấp đã chọn chia 5, nhân trọng số.</p>
    <div className="field" role="group" aria-label="Hồ sơ vị trí">
      <span>Hồ sơ vị trí</span>
      <div className="row">{evaluation.profiles.map((row, i) =>
        <button className="chip" type="button" key={row.role} aria-pressed={selected === i} onClick={() => select(i)}>{row.role}</button>)}</div>
    </div>
    <p><strong>Căn cứ cho {profile.role}</strong> · {profile.evidence}</p>
    {evaluation.factors.map((factor, i) => <div key={factor.name} className="field" role="group" aria-label={factor.name}>
      <strong>{factor.name} · tối đa {factor.weight} điểm</strong>
      <div className="row">{factor.anchors.map((anchor, index) => {
        const level = index + 1;
        return <button className="chip" type="button" key={anchor} aria-label={'Cấp ' + level}
          aria-pressed={level === levels[i]} onClick={() => setEdits((old) => ({
            ...old, [profile.role]: (old[profile.role] ?? profile.levels).map((v, k) => k === i ? level : v),
          }))}>{level}</button>;
      })}</div>
      <p>Cấp {levels[i]} · {factor.anchors[levels[i]! - 1]}</p>
      <p className="hint">{levels[i]}/5 × {factor.weight} = {result.points[i]} điểm</p>
    </div>)}
    <div className="stack" role="status">
      <strong>{result.total}/100 điểm · Ngạch {result.grade}</strong>
      <p>Hồ sơ mẫu đạt {baseline.total} điểm, ngạch {baseline.grade}. {result.grade !== baseline.grade
        ? 'Kết quả đã vượt ranh giới ngạch. Đối chiếu quyền quyết định và phạm vi ảnh hưởng thực tế trước khi đề nghị thay đổi.'
        : 'So sánh với một vị trí chuẩn cùng ngạch và ghi rõ bằng chứng cho yếu tố còn tranh luận.'}</p>
    </div>
    <p className="hint">G1 dưới 45 điểm · G2 từ 45 đến dưới 60 · G3 từ 60 đến dưới 75 · G4 từ 75. Đây là thang nội bộ giả định của bài tập.</p>
    <div className="row"><button className="btn ghost" type="button" disabled={levels.every((v, i) => v === profile.levels[i])}
      onClick={() => setEdits((old) => ({ ...old, [profile.role]: profile.levels }))}>Khôi phục hồ sơ này</button></div>
  </section>;
}
