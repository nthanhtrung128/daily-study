import { useLayoutEffect, useRef } from 'react';

/**
 * Đặt focus vào phần tử khi nó xuất hiện (thẻ mới trong phiên ôn, mặt sau thẻ vừa lật).
 * Nút vừa bấm thường biến mất ("Lật thẻ", nút chấm); không chuyển focus thì VoiceOver rơi về đầu trang.
 * Đặt focus trước lần vẽ để tiêu đề không lấy lại con trỏ khi người học vừa bắt đầu nhập.
 * Phần tử cần `tabIndex={-1}`. Không cuộn trang (phiên ôn tự cuộn lên đầu).
 */
export function useFocusOnMount<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (active) ref.current?.focus({ preventScroll: true });
  }, [active]);
  return ref;
}
