import { useLayoutEffect, useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useFocusOnMount } from '../../src/ui/useFocusOnMount';

function FirstAnswer() {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const answer = useRef<HTMLInputElement>(null);
  // Tái hiện người học chạm vào ô nhập trước khi React chạy các effect sau lần vẽ đầu.
  useLayoutEffect(() => { answer.current?.focus(); }, []);
  return <><h1 ref={heading} tabIndex={-1}>Tự thử</h1><input ref={answer} aria-label="Đáp số" /></>;
}

it('giữ con trỏ khi người học chọn ô đáp số ngay lúc màn hình xuất hiện', () => {
  render(<FirstAnswer />);
  expect(screen.getByRole('textbox', { name: 'Đáp số' })).toHaveFocus();
});
