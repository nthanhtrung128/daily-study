import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';

describe('Trang Hôm nay – phiên ôn TR', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('chọn Thẻ ghi nhớ 5 phút → lật thẻ, chấm Nhớ rõ → cập nhật tiến độ phiên', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '5 phút' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thẻ ghi nhớ' }));
    const start = screen.getByRole('button', { name: 'Bắt đầu 5 phút' });
    expect(start).toBeEnabled();
    fireEvent.click(start);

    const count = await screen.findByTestId('sess-count');
    const total = Number(count.textContent?.split('/')[1]);
    expect(total).toBeGreaterThan(5);
    expect(count).toHaveTextContent(`1/${total}`);
    fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }));
    fireEvent.click(screen.getByRole('button', { name: /Nhớ rõ/ }));
    expect(screen.getByTestId('sess-count')).toHaveTextContent(`2/${total}`);
    expect(screen.getByRole('progressbar', { name: 'Tiến độ phiên' })).toHaveAttribute('aria-valuenow', '1');

    fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }));
    fireEvent.click(screen.getByRole('button', { name: /Quên/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Xong phiên ôn hôm nay');
    expect(screen.getByText('Xem lại mục quên / sai')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('streak')).toHaveTextContent('1'));

    fireEvent.click(screen.getByRole('button', { name: 'Về trang Hôm nay' }));
    expect(screen.getByTestId('st-today')).toHaveTextContent('2');
    expect(screen.getByTestId('st-wrong')).toHaveTextContent('1');
    expect(screen.getByTestId('st-due')).toHaveTextContent('1');
  });
});
