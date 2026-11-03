import { PATTERNS, TOPICS, TOPIC_VI, type Pattern, type Topic } from './content';

/**
 * Nguồn phát cho trình phát shadowing. Một "bài" là danh sách câu phát lần lượt.
 * Hiện dùng câu mẫu theo tình huống (S4); hội thoại (S7, content/english/dialogues.json theo
 * dialogues.schema.json) chuyển bằng `dialogueTracks` — nạp file vào là có thêm bài, không phải sửa trình phát.
 */
export interface TrackLine {
  en: string;
  vi: string;
  /** Người nói (A–D) trong hội thoại; câu mẫu không có. */
  speaker?: string;
  /** Nhãn phụ, vd tình huống của câu mẫu. */
  label?: string;
}

export interface Track {
  id: string;
  title: string;
  subtitle: string;
  kind: 'patterns' | 'dialogue';
  lines: TrackLine[];
}

/** Kiểu dữ liệu hội thoại theo dialogues.schema.json. */
export interface DialogueLine {
  speaker: string;
  en: string;
  vi: string;
}
export interface Dialogue {
  id: string;
  title: string;
  situation: string;
  topic: Topic;
  level: string;
  lines: DialogueLine[];
  note?: string;
}

const CHUNK = 10;

/** Câu mẫu gom theo chủ đề, chia bài ≤ 10 câu. */
export function patternTracks(patterns: readonly Pattern[] = PATTERNS, size = CHUNK): Track[] {
  const out: Track[] = [];
  for (const t of TOPICS) {
    const list = patterns.filter((p) => p.topic === t);
    const parts = Math.ceil(list.length / size);
    for (let k = 0; k < parts; k++) {
      const chunk = list.slice(k * size, (k + 1) * size);
      out.push({
        id: `pt:${t}:${k + 1}`,
        title: `${TOPIC_VI[t]}${parts > 1 ? ` · phần ${k + 1}` : ''}`,
        subtitle: `${chunk.length} câu mẫu`,
        kind: 'patterns',
        lines: chunk.map((p) => ({ en: p.en, vi: p.vi, label: p.situation })),
      });
    }
  }
  return out;
}

export function dialogueTracks(dialogues: readonly Dialogue[]): Track[] {
  return dialogues.map((d) => ({
    id: `dl:${d.id}`,
    title: d.title,
    subtitle: `${d.situation} · ${d.level} · ${d.lines.length} câu`,
    kind: 'dialogue',
    lines: d.lines.map((l) => ({ en: l.en, vi: l.vi, speaker: l.speaker })),
  }));
}

// Nếu đã có content/english/dialogues.json (S7) thì nạp; chưa có thì glob trả về rỗng, build vẫn chạy.
const dialogueFiles = import.meta.glob<{ items: Dialogue[] }>('../../../content/english/dialogues.json', {
  eager: true,
  import: 'default',
});
export const DIALOGUES: Dialogue[] = Object.values(dialogueFiles).flatMap((f) => f.items ?? []);

/** Tất cả bài shadowing: hội thoại (nếu có) trước, rồi câu mẫu. */
export function allTracks(): Track[] {
  return [...dialogueTracks(DIALOGUES), ...patternTracks()];
}
