import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupNudge } from '../../src/ui/components/BackupNudge';
import { BackupPanel } from '../../src/ui/components/BackupPanel';
import { db } from '../../src/core/db';
import { progress } from '../../src/core/progress';
import { LAST_KEY, SNOOZE_KEY } from '../../src/core/backupReminder';
import { resetReminderForTest } from '../../src/ui/useBackupReminder';

type Nav = Navigator & { standalone?: boolean };
const nav = navigator as Nav;
const NOW = new Date(2026, 10, 20, 9).getTime();

beforeEach(async () => {
  await Promise.all([db.days.clear(), db.settings.clear(), db.recordings.clear()]);
  resetReminderForTest();
});
afterEach(() => {
  vi.restoreAllMocks();
  delete nav.standalone;
  Object.assign(navigator, { share: undefined, canShare: undefined });
});

describe('Dải nhắc sao lưu (trang Hôm nay)', () => {
  it('hiện khi đã ôn ≥ 14 ngày mà chưa sao lưu; "Để sau" ẩn và lưu thời điểm hoãn', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await db.days.put({ day: '2026-11-01', n: 12, ok: 8, s: 300 });
    await act(() => progress.load(true));
    render(<BackupNudge at={NOW} />);
    const nudge = await screen.findByTestId('backup-nudge');
    expect(nudge).toHaveTextContent('chưa sao lưu tiến độ lần nào');
    expect(screen.getByRole('link', { name: 'Sao lưu ngay' })).toHaveAttribute('href', '#cai-dat');
    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }));
    await waitFor(() => expect(screen.queryByTestId('backup-nudge')).toBeNull());
    await waitFor(async () => expect(Number((await db.settings.get(SNOOZE_KEY))?.value)).toBe(NOW + 3 * 86_400_000));
  });

  it('không hiện khi vừa sao lưu hoặc chưa ôn ngày nào', async () => {
    await act(() => progress.load(true));
    const { unmount } = render(<BackupNudge at={NOW} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('backup-nudge')).toBeNull();
    unmount();

    await db.days.put({ day: '2026-10-01', n: 5, ok: 5, s: 60 });
    await db.settings.put({ key: LAST_KEY, value: NOW - 3 * 86_400_000 });
    resetReminderForTest();
    await act(() => progress.load(true));
    render(<BackupNudge at={NOW} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('backup-nudge')).toBeNull();
  });
});

describe('Cài đặt → sao lưu kèm ghi âm', () => {
  it('chọn "Kèm bản ghi âm" → file chia sẻ có ghi âm; ghi lần sao lưu gần nhất; đổi chu kỳ nhắc', async () => {
    await db.recordings.add({ topicId: 'st-0001', title: 'Đề thử', at: 5, ms: 30_000, mime: 'audio/mp4', size: 3, data: new Uint8Array([1, 2, 3]).buffer });
    nav.standalone = true;
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    render(<BackupPanel />);
    expect(await screen.findByTestId('backup-last')).toHaveTextContent('chưa có trên máy này');
    const chip = await screen.findByRole('button', { name: /^Kèm bản ghi âm \(≈ \d/ });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Xuất tiến độ (.json)' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const f = (share.mock.calls[0]![0] as { files: File[] }).files[0]!;
    const json = JSON.parse(await f.text()) as { recordings: { data: string; title: string }[] };
    expect(json.recordings).toEqual([expect.objectContaining({ title: 'Đề thử', data: 'AQID' })]);
    expect(await screen.findByTestId('backup-status')).toHaveTextContent('1 bản ghi âm');
    await waitFor(() => expect(screen.getByTestId('backup-last')).toHaveTextContent(/Lần sao lưu gần nhất: \d\d\/\d\d\/\d{4}/));
    expect(typeof (await db.settings.get(LAST_KEY))?.value).toBe('number');

    const every = screen.getByRole('group', { name: 'Nhắc sao lưu trên trang Hôm nay' });
    expect(screen.getByRole('button', { name: 'Mỗi 14 ngày' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Tắt' }));
    expect(every.querySelector('[aria-pressed="true"]')).toHaveTextContent('Tắt');
    await waitFor(async () => expect((await db.settings.get('backup.remindDays'))?.value).toBe(0));
  });
});
