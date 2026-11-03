import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TopicScreen } from '../../src/modules/english/ui/TopicScreen';
import { db } from '../../src/core/db';
import { FakeStream } from './helpers/fakeMedia';

const streams: FakeStream[] = [];

beforeAll(() => {
  class MR {
    static isTypeSupported = (t: string) => t === 'audio/mp4';
    state = 'inactive';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror = null;
    constructor(
      _s: unknown,
      public o?: { mimeType?: string },
    ) {}
    get mimeType() {
      return this.o?.mimeType ?? '';
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['xyz'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  Object.assign(globalThis, { MediaRecorder: MR });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        const s = new FakeStream();
        streams.push(s);
        return s;
      },
    },
  });
});

afterEach(() => vi.useRealTimers());

describe('Đề nói 1 phút', () => {
  it('hết giờ đếm ngược thì tự dừng, lưu bản ghi vào IndexedDB, giải phóng micro', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    render(<TopicScreen onExit={() => undefined} />);
    fireEvent.click(document.querySelector('.sh-tracks .opt') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: '30 giây' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ghi âm' }));
    await screen.findByText(/Đang ghi âm/);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId('rec-left')).toHaveTextContent('0:20');
    act(() => {
      vi.advanceTimersByTime(20_200);
    });
    await screen.findByText(/Đã lưu bản ghi 0:30/);
    expect(streams[0]?.tracks[0]?.stopped).toBe(true);
    const rows = await db.recordings.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.mime).toBe('audio/mp4');
    expect(rows[0]?.ms).toBeGreaterThanOrEqual(30_000);
    await waitFor(() => expect(screen.getAllByTestId('rec-item')).toHaveLength(1));
  });

  it('bị từ chối quyền micro → thông báo tiếng Việt', async () => {
    const md = navigator.mediaDevices as unknown as { getUserMedia: () => Promise<never> };
    const orig = md.getUserMedia;
    md.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
    render(<TopicScreen onExit={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đề ngẫu nhiên' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ghi âm' }));
    expect(await screen.findByTestId('rec-err')).toHaveTextContent(/quyền micro/);
    md.getUserMedia = orig;
  });
});
