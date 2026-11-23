import course from '../../../content/english/communication.json';
import { dayKey } from '../../core/date';
import { isDue, levelOf, type LeitnerState } from '../../core/leitner';

export const sessions = course.items;
export type CommunicationLesson = typeof sessions[number];
export const topics = [...new Set(sessions.map((l) => l.topic))];
export const communicationHome = '#lo-trinh?giao-tiep=1';
export const communicationHref = (id: string) => '#lo-trinh?giao-tiep=' + encodeURIComponent(id);
export const communicationKey = (id: string) => 'en:' + id;

export function learningPath(stateOf: (id: string) => LeitnerState | undefined, today: string) {
  const rows = sessions.map((lesson) => ({ lesson, state: stateOf(communicationKey(lesson.id)) }));
  const due = rows.filter((r) => isDue(r.state, today)).sort((a, b) =>
    a.state!.due.localeCompare(b.state!.due) || a.state!.last - b.state!.last);
  const next = due.find((r) => dayKey(new Date(r.state!.last)) !== today) ?? rows.find((r) => !r.state) ?? due[0];
  const nextDate = rows.map((r) => r.state?.due).filter((v): v is string => !!v && v > today).sort()[0];
  return { rows, due, next, nextDate, practiced: rows.filter((r) => r.state).length,
    retained: rows.filter((r) => levelOf(r.state) === 2).length };
}

// So cùng một tình huống ở hai ngày khác nhau, tránh coi việc thử lại ngay là tiến bộ dài hạn.
export function latestComparison(logs: readonly { itemId: string; day: string; grade: number; at: number }[]) {
  for (const last of [...logs].sort((a, b) => b.at - a.at)) {
    const lesson = sessions.find((l) => communicationKey(l.id) === last.itemId);
    if (!lesson) continue;
    const previous = logs.filter((r) => r.itemId === last.itemId && r.day < last.day)
      .sort((a, b) => b.at - a.at)[0];
    if (previous) return { lesson, previous, last };
  }
}
