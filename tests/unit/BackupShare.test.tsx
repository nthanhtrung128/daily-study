import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackupPanel } from '../../src/ui/components/BackupPanel';
import { isStandalone, shareFile } from '../../src/ui/mix/download';

/** Xuất sao lưu trong app ở Màn hình chính (iOS): dùng bảng Chia sẻ thay cho <a download>. */
type Nav = Navigator & { standalone?: boolean };
const nav = navigator as Nav;

afterEach(() => {
  delete nav.standalone;
  Object.assign(navigator, { share: undefined, canShare: undefined });
});

describe('shareFile / isStandalone', () => {
  const file = new File(['{}'], 'a.json', { type: 'application/json' });
  it('không có Web Share → unsupported', async () => {
    expect(await shareFile(file)).toBe('unsupported');
  });
  it('chia sẻ được / bấm hủy / Safari đòi thao tác bấm mới', async () => {
    const share = vi.fn().mockResolvedValueOnce(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    expect(await shareFile(file)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'a.json' });
    share.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }));
    expect(await shareFile(file)).toBe('cancelled');
    share.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    expect(await shareFile(file)).toBe('needs-tap');
  });
  it('nhận ra app ở Màn hình chính trên iOS', () => {
    expect(isStandalone()).toBe(false);
    nav.standalone = true;
    expect(isStandalone()).toBe(true);
  });
});

describe('BackupPanel trong app ở Màn hình chính', () => {
  it('Xuất → bảng Chia sẻ; nếu Safari đòi bấm lại thì hiện nút "Lưu file sao lưu"', async () => {
    nav.standalone = true;
    const share = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
      .mockResolvedValueOnce(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    render(<BackupPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Xuất tiến độ (.json)' }));
    const again = await screen.findByRole('button', { name: 'Lưu file sao lưu' });
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(again);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu file sao lưu' })).toBeNull());
    expect(share).toHaveBeenCalledTimes(2);
    const f = (share.mock.calls[1]![0] as { files: File[] }).files[0]!;
    expect(f.name).toMatch(/\.json$/);
    expect(JSON.parse(await f.text())).toHaveProperty('app');
    click.mockRestore();
  });
});
