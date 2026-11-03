import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { progress } from '../../src/core/progress';
import { FakeRec } from './helpers/fakeMedia';
import { FakeSynth, IOS_VOICES } from './helpers/fakeSpeech';

const recs: FakeRec[] = [];
const synth = new FakeSynth(IOS_VOICES);

beforeAll(() => {
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
    // Safari: chỉ có tiền tố webkit.
    webkitSpeechRecognition: class extends FakeRec {
      constructor() {
        super();
        recs.push(this);
      }
    },
  });
});

const lastRec = () => recs[recs.length - 1] as FakeRec;

describe('Luyện nói có chấm (giao diện)', () => {
  beforeEach(() => {
    window.location.hash = '';
    recs.length = 0;
  });

  it('nói đúng → 100%, tô từ, "Tiếp" chấm Leitner en:say:… = Nhớ rõ; nói sai → tô sai/thiếu', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'EN 5 phút' }));
    fireEvent.click(screen.getByRole('button', { name: /^Luyện nói/ }));
    expect(await screen.findByTestId('sess-count')).toHaveTextContent('1/5');
    expect(recs).toHaveLength(0); // chưa bấm thì chưa nghe

    const target = screen.getByTestId('say-target').textContent ?? '';
    fireEvent.click(screen.getByRole('button', { name: 'Nói thử' }));
    expect(lastRec().started).toBe(1);
    expect(lastRec().lang).toBe('en-US');
    act(() => lastRec().emit([[target.split(' ').slice(0, 2).join(' '), false]]));
    expect(screen.getByTestId('say-live')).toHaveTextContent('Đang nghe');
    act(() => {
      lastRec().emit([[target, true]]);
      lastRec().end();
    });
    expect(await screen.findByTestId('say-score')).toHaveTextContent('100%');
    expect(document.querySelectorAll('[data-status="ok"]').length).toBeGreaterThan(2);

    fireEvent.click(screen.getByRole('button', { name: /^Tiếp · Nhớ rõ/ }));
    expect(screen.getByTestId('sess-count')).toHaveTextContent('2/5');
    const graded = [...progress.entries()].filter(([id]) => id.startsWith('en:say:'));
    expect(graded).toHaveLength(1);
    expect(graded[0]?.[1].box).toBe(1);

    // Câu 2: nói thiếu nửa câu.
    const t2 = screen.getByTestId('say-target').textContent ?? '';
    const words = t2.split(' ');
    fireEvent.click(screen.getByRole('button', { name: 'Nói thử' }));
    act(() => {
      lastRec().emit([[words.slice(0, Math.ceil(words.length / 3)).join(' '), true]]);
      lastRec().end();
    });
    const score = Number((await screen.findByTestId('say-score')).textContent?.replace('%', ''));
    expect(score).toBeLessThan(60);
    expect(document.querySelectorAll('[data-status="missing"]').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Tiếp · Quên/ }));
    const g2 = [...progress.entries()].filter(([id]) => id.startsWith('en:say:') && progress.stateOf(id)?.wrong);
    expect(g2).toHaveLength(1);
  });

  it('bị từ chối quyền → thông báo tiếng Việt, mở ô gõ / đọc chính tả để chấm', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Luyện nói/ }));
    const target = (await screen.findByTestId('say-target')).textContent ?? '';
    fireEvent.click(screen.getByRole('button', { name: 'Nói thử' }));
    act(() => {
      lastRec().error('not-allowed');
      lastRec().end();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/quyền micro/);
    fireEvent.change(screen.getByLabelText(/Câu bạn nói/), { target: { value: target } });
    fireEvent.click(screen.getByRole('button', { name: 'Chấm câu này' }));
    expect(screen.getByTestId('say-score')).toHaveTextContent('100%');
  });

  it('câu mẫu: nút "Nói thử" trong thẻ, "Chấm theo điểm" đưa vào Leitner', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Câu mẫu/ }));
    fireEvent.click(await screen.findByRole('button', { name: /sang tự thay từ/ }));
    const sentence = screen.getByTestId('pt-sentence').textContent ?? '';
    fireEvent.click(screen.getByRole('button', { name: 'Nói thử' }));
    act(() => {
      lastRec().emit([[sentence, true]]);
      lastRec().end();
    });
    expect(await screen.findByTestId('say-score')).toHaveTextContent('100%');
    const before = screen.getByTestId('sess-count').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Chấm theo điểm · Nhớ rõ' }));
    expect(screen.getByTestId('sess-count').textContent).not.toBe(before);
  });
});
