import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import module05 from '../../../content/tr-roadmap/m05.json';
import module06 from '../../../content/tr-roadmap/m06.json';
import module09 from '../../../content/tr-roadmap/m09.json';
import { db, setSetting } from '../../core/db';

export const CURRICULUM = [
  { code: 'M01', title: 'Chiến lược Total Rewards' },
  { code: 'M02', title: 'Khung pháp lý về đãi ngộ' },
  { code: 'M03', title: 'Công bằng và minh bạch lương' },
  { code: 'M04', title: 'Phân tích và đánh giá công việc' },
  module05,
  module06,
  { code: 'M07', title: 'Lương biến đổi và khuyến khích' },
  { code: 'M08', title: 'Định giá lương thị trường' },
  module09,
  { code: 'M10', title: 'Tài chính cho Total Rewards' },
  { code: 'M11', title: 'Business case và truyền thông' },
  { code: 'M12', title: 'Đãi ngộ toàn cầu' },
  { code: 'M13', title: 'Phúc lợi và sức khỏe toàn diện' },
  { code: 'M14', title: 'Phát triển và nghề nghiệp' },
  { code: 'M15', title: 'Lương thưởng kinh doanh' },
  { code: 'M16', title: 'Đãi ngộ lãnh đạo' },
  { code: 'M17', title: 'Cổ phiếu và đãi ngộ vốn' },
] as const;

export const ROADMAP_MODULES = CURRICULUM.filter((entry) => 'lessons' in entry);
export type RoadmapLesson = typeof module05.lessons[number];
export { module06, module09 };

const courseSteps = ROADMAP_MODULES.flatMap(({ code, lessons }) =>
  lessons.map((lesson) => ({ code, lesson })),
);

export function courseProgress(completed: readonly string[]) {
  const remaining = courseSteps.filter(({ lesson }) => !completed.includes(lesson.id));
  return { next: remaining[0], count: courseSteps.length - remaining.length, total: courseSteps.length };
}

// Khi tự chọn bài ở giữa, đi tiếp theo thứ tự rồi quay về các bài còn thiếu.
export function nextAfter(id: string, completed: readonly string[]) {
  const index = courseSteps.findIndex(({ lesson }) => lesson.id === id);
  return [...courseSteps.slice(index + 1), ...courseSteps.slice(0, index)]
    .find(({ lesson }) => !completed.includes(lesson.id));
}

const prefix = 'tr.roadmap.';

export function useRoadmapProgress() {
  const [completed, setCompleted] = useState<string[]>();

  useEffect(() => {
    const subscription = liveQuery(() => db.settings.where('key').startsWith(prefix).toArray()).subscribe({
      next: (rows) => setCompleted(rows.filter((row) => row.value === true).map((row) => row.key.slice(prefix.length))),
      error: () => setCompleted(undefined),
    });
    return () => subscription.unsubscribe();
  }, []);

  return completed;
}

export function completeLesson(id: string) {
  return setSetting(prefix + id, true);
}
