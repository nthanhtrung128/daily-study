import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import module01 from '../../../content/tr-roadmap/m01.json';
import module02 from '../../../content/tr-roadmap/m02.json';
import module03 from '../../../content/tr-roadmap/m03.json';
import module04 from '../../../content/tr-roadmap/m04.json';
import module05 from '../../../content/tr-roadmap/m05.json';
import module06 from '../../../content/tr-roadmap/m06.json';
import module07 from '../../../content/tr-roadmap/m07.json';
import module08 from '../../../content/tr-roadmap/m08.json';
import module09 from '../../../content/tr-roadmap/m09.json';
import module10 from '../../../content/tr-roadmap/m10.json';
import module11 from '../../../content/tr-roadmap/m11.json';
import module12 from '../../../content/tr-roadmap/m12.json';
import module13 from '../../../content/tr-roadmap/m13.json';
import module14 from '../../../content/tr-roadmap/m14.json';
import module15 from '../../../content/tr-roadmap/m15.json';
import module16 from '../../../content/tr-roadmap/m16.json';
import module17 from '../../../content/tr-roadmap/m17.json';
import { db, setSetting } from '../../core/db';

export const COURSE_STAGES = [
  { title: 'Nền tảng Total Rewards', modules: [module01, module02, module03, module04] },
  { title: 'Thiết kế lương và thưởng', modules: [module05, module06, module07, module08, module09] },
  { title: 'Quản trị chương trình đãi ngộ', modules: [module10, module11, module12, module13, module14] },
  { title: 'Đãi ngộ chuyên sâu', modules: [module15, module16, module17] },
];
export const ROADMAP_MODULES = COURSE_STAGES.flatMap((stage) => stage.modules);
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
