/** Tải một file văn bản tạo trên máy (Blob + thẻ <a download>), không gửi gì ra ngoài. */
export function downloadText(name: string, text: string, mime: string, doc: Document = document): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // Safari cần URL còn sống một lúc sau khi bấm.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Đang chạy như app ở Màn hình chính (iOS: navigator.standalone; nơi khác: display-mode standalone). */
export function isStandalone(win: Window = window): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    return !!win.matchMedia?.('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'needs-tap' | 'unsupported';

/**
 * Mở bảng Chia sẻ với một file (iOS: có "Lưu vào Tệp"). Dùng trong app ở Màn hình chính, nơi `<a download>`
 * có thể không làm gì. `needs-tap`: Safari đòi thao tác bấm mới (đã qua bước chờ đọc IndexedDB) → bấm lại nút.
 */
export async function shareFile(file: File, nav: Navigator = navigator): Promise<ShareOutcome> {
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || !nav.canShare({ files: [file] })) return 'unsupported';
  try {
    await nav.share({ files: [file], title: file.name });
    return 'shared';
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError') return 'needs-tap';
    return 'unsupported';
  }
}
