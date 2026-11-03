import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { progress } from '../../src/core/progress';
import { FakeSynth, IOS_VOICES } from './helpers/fakeSpeech';

const synth = new FakeSynth(IOS_VOICES);

beforeAll(() => {
  // speechSynthesis giả trên window (jsdom không có). Lớp bọc đọc lúc dùng lần đầu.
  Object.assign(globalThis, {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: class {
      lang = '';
      rate = 1;
      pitch = 1;
      voice = null;
      onend = null;
      onerror = null;
      constructor(public text: string) {}
    },
  });
});

describe('Trang Hôm nay – khối tiếng Anh', () => {
  beforeEach(() => {
    window.location.hash = '';
    synth.spoken = [];
  });

  it('thẻ từ: nghe chỉ phát khi bấm, lật thẻ, tự đặt câu, chấm → sang thẻ 2, lưu Leitner en:ph-…', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'EN 5 phút' }));
    fireEvent.click(screen.getByRole('button', { name: /^Thẻ từ/ }));
    expect(await screen.findByTestId('sess-count')).toHaveTextContent('1/10');
    expect(synth.spoken).toHaveLength(0); // không tự phát

    // Thẻ mới luôn EN → VI.
    const card = document.querySelector('.en-card') as HTMLElement;
    expect(within(card).getByText(/EN → VI/)).toBeInTheDocument();
    const phrase = card.querySelector('h2')?.textContent ?? '';
    fireEvent.click(within(card).getByRole('button', { name: `Nghe: ${phrase}` }));
    expect(synth.last?.text).toBe(phrase);
    expect(synth.last?.lang).toBe('en-US');

    fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }));
    fireEvent.change(screen.getByLabelText('Tự đặt câu'), { target: { value: 'My own sentence.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu câu' }));
    expect(screen.getByText('Đã lưu trên máy.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Nhớ rõ/ }));
    expect(screen.getByTestId('sess-count')).toHaveTextContent('2/10');

    const graded = [...progress.entries()].filter(([id]) => id.startsWith('en:ph-'));
    expect(graded).toHaveLength(1);
    const [id, st] = graded[0] as [string, { box: number }];
    expect(st.box).toBe(1);
    expect(progress.note(id)).toBe('My own sentence.');

    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Xong phiên tiếng Anh');
  });

  it('câu mẫu: nghe → nhại → đổi slot, đọc lại câu đã thay', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Câu mẫu/ }));
    const sentence = await screen.findByTestId('pt-sentence');
    const original = sentence.textContent ?? '';
    fireEvent.click(screen.getByRole('button', { name: /^Nghe câu:/ }));
    expect(synth.last?.text).toBe(original);

    fireEvent.click(screen.getByRole('button', { name: /sang tự thay từ/ }));
    const group = screen.getByRole('group', { name: 'Chỗ thay 1' });
    const chips = within(group).getAllByRole('button');
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    const alt = chips[1]?.textContent ?? '';
    fireEvent.click(chips[1] as HTMLElement);
    expect(chips[1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('pt-sentence').textContent).toContain(alt);
    expect(screen.getByTestId('pt-sentence').textContent).not.toBe(original);

    fireEvent.click(screen.getByRole('button', { name: /^Nghe câu đã thay/ }));
    expect(synth.last?.text).toContain(alt);
    fireEvent.click(screen.getByRole('button', { name: /Mơ hồ/ }));
    expect(screen.getByTestId('sess-count')).toHaveTextContent(/^2\//);
  });

  it('shadowing: chọn bài, phát / dừng, ẩn chữ; rời màn thì hủy đọc', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Shadowing/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Công sở/ })[0] as HTMLElement);
    expect(screen.getByTestId('sh-count')).toHaveTextContent('1/10');
    fireEvent.click(screen.getByRole('button', { name: 'Phát' }));
    expect(synth.spoken).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Tạm dừng' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Câu sau' }));
    expect(screen.getByTestId('sh-count')).toHaveTextContent('2/10');
    expect(synth.spoken).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn chữ' }));
    expect(screen.getByTestId('sh-en')).toHaveTextContent('Đã ẩn chữ');
    const before = synth.cancels;
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(synth.cancels).toBeGreaterThan(before);
    expect(screen.getByRole('heading', { name: 'Luyện nói công sở' })).toBeInTheDocument();
  });
});
