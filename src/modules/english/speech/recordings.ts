import { db as defaultDb, type Recording, type StudyDB } from '../../../core/db';

/**
 * Kho bản ghi âm đề nói (bảng `recordings` trong IndexedDB). Âm thanh lưu dạng ArrayBuffer + mimeType
 * (Safari cũ không lưu được Blob vào IndexedDB), dựng lại Blob khi phát.
 */
export type { Recording };

export interface NewRecording {
  topicId: string;
  title: string;
  blob: Blob;
  ms: number;
  mime?: string;
  transcript?: string;
  at?: number;
}

async function toBuffer(b: Blob): Promise<ArrayBuffer> {
  if (typeof b.arrayBuffer === 'function') return b.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(b);
  });
}

export async function saveRecording(r: NewRecording, store: StudyDB = defaultDb): Promise<number> {
  const data = await toBuffer(r.blob);
  const row: Recording = {
    topicId: r.topicId,
    title: r.title,
    at: r.at ?? Date.now(),
    ms: Math.max(0, Math.round(r.ms)),
    mime: r.mime || r.blob.type || 'audio/mp4',
    size: data.byteLength,
    data,
  };
  if (r.transcript?.trim()) row.transcript = r.transcript.trim();
  const id = await store.recordings.add(row);
  // Xin trình duyệt giữ dữ liệu lâu dài (Safari có thể xóa dữ liệu web không dùng sau 7 ngày).
  try {
    void (globalThis.navigator?.storage?.persist?.() ?? Promise.resolve()).catch(() => undefined);
  } catch {
    /* bỏ qua */
  }
  return id as number;
}

/** Danh sách bản ghi, mới nhất trước; truyền topicId để lọc theo đề. */
export async function listRecordings(topicId?: string, store: StudyDB = defaultDb): Promise<Recording[]> {
  const rows = topicId ? await store.recordings.where('topicId').equals(topicId).toArray() : await store.recordings.toArray();
  return rows.sort((a, b) => b.at - a.at);
}

export async function deleteRecording(id: number, store: StudyDB = defaultDb): Promise<void> {
  await store.recordings.delete(id);
}

export function recordingBlob(r: Pick<Recording, 'data' | 'mime'>): Blob {
  return new Blob([r.data], { type: r.mime });
}

/** "1,2 MB" / "350 KB" theo vi-VN. */
export function fmtSize(bytes: number): string {
  const f = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  if (bytes >= 1024 * 1024) return `${f(bytes / 1024 / 1024)} MB`;
  return `${f(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

/** "0:45" */
export function fmtDur(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
