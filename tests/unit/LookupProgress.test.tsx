import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { progress } from '../../src/core/progress';
import { LookupPage } from '../../src/ui/pages/LookupPage';
import { ProgressPage } from '../../src/ui/pages/ProgressPage';

function openItem(title: string) {
  const summary = screen.getByText(title, { selector: 'summary b' }).closest('summary')!;
  const details = summary.parentElement as HTMLDetailsElement;
  act(() => {
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
  });
  return details;
}

describe('Tra cứu → chấm mức thuộc, ghi chú → Tiến độ', () => {
  it('tìm không dấu, mở mục, chấm, ghi chú; trang Tiến độ cập nhật', async () => {
    render(<LookupPage />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'tong dai ngo' } });
    await waitFor(() => expect(screen.getByTestId('lk-count')).not.toHaveTextContent(/^\d{3,} kết quả/));
    const d = openItem('Tổng đãi ngộ');
    const body = within(d);
    expect(body.getByText('Ý chính')).toBeInTheDocument();
    expect(body.getByText('Chưa học')).toBeInTheDocument();

    fireEvent.click(body.getByRole('button', { name: /Quên/ }));
    expect(body.getByText(/Đã chấm: Quên → hộp 1/)).toBeInTheDocument();
    expect(progress.stateOf('tr:K001')).toMatchObject({ box: 1, wrong: 1 });

    const note = body.getByLabelText('Ghi chú');
    fireEvent.change(note, { target: { value: 'Tự viết lại định nghĩa' } });
    fireEvent.blur(note);
    expect(body.getByText('Đã lưu ghi chú')).toBeInTheDocument();
    expect(progress.note('tr:K001')).toBe('Tự viết lại định nghĩa');

    // Lọc theo loại: chỉ cụm từ tiếng Anh.
    fireEvent.change(input, { target: { value: 'touch base' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cụm từ EN' }));
    expect(screen.queryByRole('group', { name: 'Buổi' })).toBeNull();
    await waitFor(() => expect(screen.getByText('touch base', { selector: 'summary b' })).toBeInTheDocument());
  });

  it('trang Tiến độ: số liệu, danh sách hay sai', async () => {
    progress.grade('tr:Q001', 0);
    render(<ProgressPage />);
    await waitFor(() => expect(screen.getByTestId('pg-reviews')).toHaveTextContent('2'));
    expect(screen.getByTestId('pg-streak')).toHaveTextContent('1');
    const hard = screen.getByTestId('hard-list');
    expect(within(hard).getAllByRole('row')).toHaveLength(3);
    expect(within(hard).getByText('Tổng đãi ngộ')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /đã thuộc, .* đang học trên/ }).length).toBeGreaterThanOrEqual(13);
    expect(screen.getByRole('button', { name: 'Ôn ngay các mục này' })).toBeInTheDocument();
  });
});
