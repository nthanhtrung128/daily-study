import type { Level, Topic } from '../content';

/**
 * Đề nói 1 phút. Nội dung chính nằm ở content/english/speaking-topics.json (soạn ở S7, theo
 * speaking-topics.schema.json). Có file thì nạp file; chưa có thì dùng vài đề tạm dưới đây để màn hình chạy được.
 */
export interface SpeakingTopic {
  id: string;
  en: string;
  vi: string;
  topic: Topic;
  level: Level;
  hints: string[];
  seconds?: number;
  trConcept?: string;
  /** Cụm nên dùng (S7). */
  useful?: string[];
  /** Câu mở đầu mẫu (S7). */
  opener?: string;
}

/** Đề tạm (tự soạn) — chỉ dùng khi chưa có speaking-topics.json. Id "st-tmp-*" để không trùng đề thật. */
export const FALLBACK_TOPICS: readonly SpeakingTopic[] = [
  {
    id: 'st-tmp-01',
    en: 'Introduce yourself and your role in the C&B team to a new colleague.',
    vi: 'Giới thiệu bản thân và vai trò của bạn trong nhóm C&B với một đồng nghiệp mới.',
    topic: 'office',
    level: 'B1',
    hints: ['I look after…', 'My main responsibilities are…', 'You can come to me if…'],
  },
  {
    id: 'st-tmp-02',
    en: 'Explain the difference between base salary and total cash compensation.',
    vi: 'Giải thích khác nhau giữa lương cơ bản và tổng thu nhập tiền mặt.',
    topic: 'cb-hr',
    level: 'B2',
    hints: ['Base salary is the fixed part…', 'On top of that, there are allowances and bonuses…', 'For example…'],
  },
  {
    id: 'st-tmp-03',
    en: 'Describe how your company reviews salaries every year.',
    vi: 'Mô tả cách công ty bạn xét tăng lương hằng năm.',
    topic: 'cb-hr',
    level: 'B2',
    hints: ['The cycle starts in…', 'We look at performance and market data…', 'Managers then propose…', 'Finally…'],
  },
  {
    id: 'st-tmp-04',
    en: 'Give a short update on a project you are working on this week.',
    vi: 'Cập nhật ngắn về một dự án bạn đang làm tuần này.',
    topic: 'meetings',
    level: 'B1',
    hints: ['So far we have…', 'The main challenge is…', 'Next week I plan to…'],
  },
  {
    id: 'st-tmp-05',
    en: 'Explain to an employee why their payslip shows a lower net pay this month.',
    vi: 'Giải thích cho nhân viên vì sao phiếu lương tháng này thực nhận thấp hơn.',
    topic: 'cb-hr',
    level: 'B2',
    hints: ['Let me walk you through it…', 'The main reason is…', 'Social insurance and personal income tax…', 'If you have any questions…'],
  },
  {
    id: 'st-tmp-06',
    en: 'Ask your manager for a deadline extension and propose a new plan.',
    vi: 'Xin quản lý gia hạn và đề xuất kế hoạch mới.',
    topic: 'negotiation',
    level: 'B2',
    hints: ['I wanted to give you a heads-up…', 'Would it be possible to…', 'Here is what I suggest…'],
  },
];

// Nếu đã có content/english/speaking-topics.json (S7) thì nạp; chưa có thì glob rỗng, build vẫn chạy.
const files = import.meta.glob<{ items: SpeakingTopic[] }>('../../../../content/english/speaking-topics.json', {
  eager: true,
  import: 'default',
});

export function loadTopics(f: Record<string, { items?: SpeakingTopic[] }> = files): SpeakingTopic[] {
  const list = Object.values(f).flatMap((x) => x.items ?? []);
  return list.length ? list : [...FALLBACK_TOPICS];
}

export const SPEAKING_TOPICS: SpeakingTopic[] = loadTopics();
/** true khi đang dùng đề tạm (chưa có file nội dung). */
export const USING_FALLBACK_TOPICS = SPEAKING_TOPICS.every((t) => t.id.startsWith('st-tmp-'));

export const DURATIONS = [30, 60, 90] as const;
/** Thời gian mặc định của đề: theo `seconds` nếu khớp 30/60/90, không thì gần nhất. */
export function defaultSeconds(t: Pick<SpeakingTopic, 'seconds'>): number {
  const s = t.seconds ?? 60;
  return DURATIONS.reduce((best, d) => (Math.abs(d - s) < Math.abs(best - s) ? d : best), 60);
}
