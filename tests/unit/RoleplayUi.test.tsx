import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { progress } from '../../src/core/progress';
import { RP_DIALOGUES, loadRpStore } from '../../src/modules/english/roleplay';
import { FakeRec } from './helpers/fakeMedia';
import { FakeSynth, IOS_VOICES } from './helpers/fakeSpeech';

const recs: FakeRec[] = [];
const synth = new FakeSynth(IOS_VOICES);
const D = RP_DIALOGUES[0]!; // dl-0001: A A B A A C A B A A

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
    webkitSpeechRecognition: class extends FakeRec {
      constructor() {
        super();
        recs.push(this);
      }
    },
  });
});

const lastRec = () => recs[recs.length - 1] as FakeRec;
const spoken = () => synth.spoken.map((u) => u.text);
/** Máy đọc xong câu hiện tại. */
const ttsEnd = () => act(async () => synth.end());

async function open(role = 'B') {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /^Nhập vai/ }));
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(D.title) }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${role} ·`) }));
}

describe('Hội thoại nhập vai (giao diện)', () => {
  beforeEach(() => {
    window.location.hash = '';
    recs.length = 0;
    synth.spoken.length = 0;
  });

  it('chọn bài + vai → app đọc vai kia nối tiếp → nói → điểm → kết quả, lưu bài đã luyện', async () => {
    await open();
    // Vai mặc định của bài này là vai C&B (A); chưa bấm Bắt đầu thì chưa đọc.
    expect(spoken()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    expect(spoken()).toEqual([D.lines[0]?.en]);
    expect(screen.getByTestId('rp-current')).toHaveTextContent(D.lines[0]!.en);
    await ttsEnd();
    expect(spoken()).toHaveLength(2); // lượt sau tự nối tiếp
    await ttsEnd();

    // Lượt của người học (câu 3): mức "Hiện câu" → thấy câu đích; chưa bấm micro thì chưa nghe.
    const target = D.lines[2]!.en;
    expect(screen.getByTestId('rp-target')).toHaveTextContent(target);
    expect(spoken()).toHaveLength(2);
    expect(recs).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Chỉ nghĩa' }));
    expect(screen.queryByTestId('rp-target')).toBeNull();
    expect(screen.getByTestId('rp-current')).toHaveTextContent(D.lines[2]!.vi);
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn hết' }));
    expect(screen.getByTestId('rp-current')).not.toHaveTextContent(D.lines[2]!.vi);

    fireEvent.click(screen.getByRole('button', { name: 'Bấm để nói' }));
    expect(lastRec().lang).toBe('en-US');
    act(() => {
      lastRec().emit([[target, true]]);
      lastRec().end();
    });
    expect(await screen.findByTestId('rp-score')).toHaveTextContent('100%');
    expect(screen.getByTestId('say-diff')).toHaveTextContent('How long');
    expect(screen.getByRole('button', { name: 'Nói lại' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nghe mẫu' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /^Tiếp/ }));
    expect(spoken().at(-1)).toBe(D.lines[3]?.en);
    // Câu ≥ 4 từ chấm vào lịch nói, tính lượt ôn trong ngày (chuỗi ngày), điểm nói.
    expect(progress.stateOf(`en:say:${D.id}:3`)?.box).toBe(1);
    const day = progress.dayStat(progress.today());
    expect(day.n).toBeGreaterThan(0);
    expect(day.kn).toBe(1);
    expect(day.ks).toBe(100);

    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));
    expect(await screen.findByRole('heading', { name: 'Xong hội thoại' })).toBeVisible();
    expect(screen.getByTestId('rp-avg')).toHaveTextContent('100%');
    await waitFor(async () => expect((await loadRpStore())[D.id]).toMatchObject({ score: 100, role: 'B', n: 1, total: 2 }));

    fireEvent.click(screen.getByRole('button', { name: 'Chọn bài khác' }));
    expect(await screen.findByRole('button', { name: new RegExp(D.title) })).toHaveTextContent('Đã luyện · 100%');
  });

  it('bị từ chối quyền micro → thông báo tiếng Việt, tự đánh giá Quên / Mơ hồ / Nhớ rõ vẫn luyện tiếp được', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    await ttsEnd();
    await ttsEnd();
    fireEvent.click(screen.getByRole('button', { name: 'Bấm để nói' }));
    act(() => {
      lastRec().error('not-allowed');
      lastRec().end();
    });
    expect(await screen.findByTestId('rp-self')).toHaveTextContent(/quyền micro.*tự đánh giá/);
    fireEvent.click(screen.getByRole('button', { name: /^Mơ hồ/ }));
    expect(spoken().at(-1)).toBe(D.lines[3]?.en);
    // Hai câu của A, một câu của C rồi tới lượt B: vẫn ở chế độ tự đánh giá.
    for (let k = 0; k < 4; k++) await ttsEnd();
    expect(screen.getByTestId('rp-self')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /^Quên/ }));
    for (let k = 0; k < 2; k++) await ttsEnd();
    expect(await screen.findByRole('heading', { name: 'Xong hội thoại' })).toBeVisible();
    expect(screen.getByTestId('rp-avg')).toHaveTextContent('–');
    expect(screen.getByTestId('rp-weak').querySelectorAll('details')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Luyện lại 2 câu điểm thấp' })).toBeVisible();
  });
});
