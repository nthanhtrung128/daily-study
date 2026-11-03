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
