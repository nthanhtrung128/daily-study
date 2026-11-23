import { COURSE_STAGES } from './roadmap';
import { lessonHref } from '../../ui/routes';
import { capstoneHref } from './Capstone';
import { equityHref } from './PayEquityCase';
import { offerHref } from './OfferCase';

export const stagePractice = [
  { name: 'So hai thư mời đãi ngộ', href: offerHref },
  { name: 'Lập phiếu điều tra công bằng lương', href: equityHref },
  { name: 'Trình bày đề xuất với CFO', href: lessonHref('trm-11-02') },
  { name: 'Bảo vệ đề xuất giữ người', href: capstoneHref },
] as const;

export function CourseMap({ completed, nextId }: { completed: readonly string[] | undefined; nextId: string | undefined }) {
  function open(index: number) {
    const heading = document.getElementById('stage-' + index);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start' });
  }
  return <section className="panel stack" aria-labelledby="course-map-title">
    <h2 className="h-sec" id="course-map-title">Bản đồ bốn chặng</h2>
    <ol className="course-map">{COURSE_STAGES.map((stage, i) => {
      const lessons = stage.modules.flatMap((m) => m.lessons);
      const count = lessons.filter((l) => completed?.includes(l.id)).length;
      const current = lessons.some((l) => l.id === nextId);
      return <li key={stage.title} aria-current={current ? 'step' : undefined}>
        <button type="button" className="map-step" onClick={() => open(i)}>
          <span className="map-index" aria-hidden="true">{i + 1}</span>
          <span><strong>{stage.title}</strong><span className="map-status">{stage.modules[0]!.code}–{stage.modules[stage.modules.length - 1]!.code}
            {completed && ' · ' + count + '/' + lessons.length + ' bài'}{current ? ' · Học tiếp tại đây' : completed && count === lessons.length ? ' · Hoàn thành' : ''}</span></span>
        </button>
      </li>;
    })}</ol>
  </section>;
}
