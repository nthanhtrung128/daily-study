import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { db, getSetting } from '../../src/core/db';
import { progress } from '../../src/core/progress';
import { DAILY_KEY } from '../../src/core/prefs';
import { tally, type DailyResult } from '../../src/modules/mix/result';
import { ITEMS } from '../../src/modules/tr/items';
import { EN_ITEMS } from '../../src/modules/english/content';
import { FakeSynth, IOS_VOICES } from './helpers/fakeSpeech';

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
  });
});

/** Trả lời mục đang hiện bất kể loại (thẻ, trắc nghiệm, bài tính, câu mẫu, nói, đề nói). `ok` = chọn Nhớ rõ / đúng nếu được. */
function answer(ok: boolean) {
  const q = (name: string | RegExp) => screen.queryByRole('button', { name });
  const gradeBtn = () => q(ok ? /Nhớ rõ/ : /Quên/);
  if (q('Xong đề nói · tiếp')) return fireEvent.click(q('Xong đề nói · tiếp')!);
  if (q('Bỏ qua')) return fireEvent.click(q('Bỏ qua')!);
  for (const flip of ['Lật thẻ', 'Xem gợi ý & tự chấm', 'Xem nghĩa', 'Đã nhại · sang tự thay từ']) {
    if (q(flip)) {
      fireEvent.click(q(flip)!);
      return fireEvent.click(gradeBtn()!);
    }
  }
  const opts = document.querySelectorAll<HTMLButtonElement>('.opt');
  if (opts.length) {
    fireEvent.click(opts[0]!);
    return fireEvent.click(q('Câu tiếp')!);
  }
  const input = screen.queryByLabelText('Đáp số');
  if (input) {
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.click(q('Kiểm tra')!);
    return fireEvent.click(q('Câu tiếp')!);
  }
  throw new Error('Không nhận ra loại mục');
}

describe('Phiên hằng ngày trộn TR + EN', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('chọn 10 phút → bắt đầu → xen kẽ TR/EN, thanh tiến độ → kết thúc → kết quả theo phần, chuỗi ngày', async () => {
    render(<App />);
    const group = screen.getByRole('group', { name: 'Thời lượng phiên hôm nay' });
    expect(within(group).getByRole('button', { name: '15 phút' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: '10 phút' }));
    expect(screen.getByTestId('daily-sum')).toHaveTextContent('1 câu nói có chấm');
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ôn hôm nay' }));

    const count = await screen.findByTestId('sess-count');
    const total = Number(count.textContent?.split('/')[1]);
    expect(total).toBeGreaterThan(6);
    const lanes: string[] = [];
    for (let k = 0; k < 6; k++) {
      lanes.push(screen.getByTestId('mix-lane').getAttribute('data-lane') ?? '');
      answer(k % 3 !== 2);
      await waitFor(() => expect(screen.getByTestId('sess-count')).toHaveTextContent(`${k + 2}/${total}`));
    }
    expect(new Set(lanes.filter((l) => l !== 'speak'))).toEqual(new Set(['tr', 'en']));
    expect(screen.getByRole('progressbar', { name: 'Tiến độ phiên' })).toHaveAttribute('aria-valuenow', '6');
    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Xong phiên hôm nay');
    const trRow = screen.getByTestId('mix-row-tr');
    const enRow = screen.getByTestId('mix-row-en');
    const n = (row: HTMLElement) => Number(row.querySelectorAll('td')[0]?.textContent);
    expect(n(trRow) + n(enRow)).toBeGreaterThanOrEqual(5);
    expect(screen.getByText('Cần ôn lại')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('streak')).toHaveTextContent('1'));
    expect(progress.dayStat(progress.today()).s).toBeGreaterThanOrEqual(0);
    expect(progress.newToday()).toBeGreaterThanOrEqual(5);

    fireEvent.click(screen.getByRole('button', { name: 'Về trang Hôm nay' }));
    expect(Number(screen.getByTestId('st-today').textContent)).toBeGreaterThanOrEqual(5);
    // Lối vào riêng TR / EN vẫn còn.
    expect(screen.getByRole('heading', { name: 'Total Rewards' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Luyện nói công sở' })).toBeInTheDocument();
  });
});

describe('Cài đặt', () => {
  beforeEach(() => {
    window.location.hash = '#cai-dat';
  });

  it('đổi tỉ lệ, mục mới, luyện nói, thời lượng, giọng & tốc độ → lưu Dexie; trang Hôm nay dùng cài đặt mới', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cài đặt');
    expect(screen.getByTestId('share-val')).toHaveTextContent('TR 40% · Tiếng Anh 60%');
    fireEvent.change(screen.getByLabelText('Tỉ lệ thời gian TR / tiếng Anh'), { target: { value: '70' } });
    expect(screen.getByTestId('share-val')).toHaveTextContent('TR 70% · Tiếng Anh 30%');
    fireEvent.click(within(screen.getByRole('group', { name: 'Số mục mới tối đa mỗi ngày' })).getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kèm 1 bài luyện nói' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Thời lượng mặc định' })).getByRole('button', { name: '20 phút' }));
    fireEvent.click(screen.getByRole('button', { name: 'Giọng Anh' }));
    fireEvent.click(screen.getByRole('button', { name: '0,75×' }));
    expect(screen.getByRole('button', { name: '0,75×' })).toHaveAttribute('aria-pressed', 'true');

    await waitFor(async () =>
      expect(await getSetting(DAILY_KEY, null)).toMatchObject({ trShare: 0.7, maxNew: 5, speak: false, min: 20 }),
    );
    await waitFor(async () => expect(await getSetting('en.tts', null)).toMatchObject({ accent: 'en-GB', rate: 0.75 }));

    fireEvent.click(screen.getByRole('button', { name: 'Nghe thử' }));
    expect(synth.last?.lang).toBe('en-GB');
    expect(synth.last?.rate).toBe(0.75);

    fireEvent.click(screen.getByRole('link', { name: 'Hôm nay' }));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const sum = await screen.findByTestId('daily-sum');
    // Tắt luyện nói → không kèm bài nói; phiên trước đã học ≥ 5 mục mới → hết hạn mức 5, chỉ còn mục cần ôn lại.
    expect(sum).not.toHaveTextContent('đề nói');
    expect(sum).not.toHaveTextContent('câu nói');
    expect(screen.getByText(/mục mới hôm nay/).textContent).toMatch(/còn 0\/5 mục mới/);
    const tr = Number(/(\d+) mục TR/.exec(sum.textContent ?? '')?.[1]);
    const en = Number(/(\d+) mục tiếng Anh/.exec(sum.textContent ?? '')?.[1]);
    const review = [...progress.entries()].filter(([id, st]) => !id.startsWith('en:say:') && (st.wrong > 0 || st.due <= progress.today())).length;
    expect(tr + en).toBe(review);
    expect(screen.getByText(/TR 70% · Tiếng Anh 30%/)).toBeInTheDocument();
  });

  it('tạo file .ics: chọn giờ, bỏ bớt ngày → tải file text/calendar; bỏ hết ngày thì nút bị khóa', async () => {
    const blobs: Blob[] = [];
    const create = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:ics';
    });
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<App />);
    fireEvent.change(screen.getByLabelText('Giờ nhắc'), { target: { value: '07:45' } });
    const days = screen.getByRole('group', { name: 'Ngày nhắc' });
    fireEvent.click(within(days).getByRole('button', { name: 'Thứ bảy' }));
    fireEvent.click(within(days).getByRole('button', { name: 'Chủ nhật' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tải file nhắc lịch (.ics)' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ics-msg')).toHaveTextContent('nhắc lúc 07:45, T2, T3, T4, T5, T6');
    const blob = blobs[0]!;
    expect(blob.type).toBe('text/calendar;charset=utf-8');
    const text = await blob.text();
    expect(text).toContain('RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=MO,TU,WE,TH,FR');
    expect(text).toMatch(/DTSTART;TZID=Asia\/Bangkok:\d{8}T074500/);

    for (const d of ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu']) fireEvent.click(within(days).getByRole('button', { name: d }));
    expect(screen.getByRole('button', { name: 'Tải file nhắc lịch (.ics)' })).toBeDisabled();
    click.mockRestore();
    await db.settings.clear();
  });
});

describe('tally – kết quả theo phần', () => {
  it('đếm đúng/mơ hồ/sai theo TR/EN, bài nói, mục cần ôn lại (sai trước)', () => {
    const tr = ITEMS[0]!;
    const en = EN_ITEMS[0]!;
    const r: DailyResult[] = [
      { entry: { lane: 'tr', tier: 'new', secs: 25, item: tr }, g: 2 },
      { entry: { lane: 'tr', tier: 'due', secs: 25, item: tr }, g: 1 },
      { entry: { lane: 'en', tier: 'new', secs: 30, item: en }, g: 0 },
      { entry: { lane: 'en', tier: 'extra', secs: 150, item: { kind: 'topic', id: 'topic:x', topic: { id: 'x', en: 'T', vi: 'T', topic: 'office', level: 'B1', hints: [] } } }, g: null },
    ];
    const t = tally(r);
    expect(t.tr).toEqual({ n: 2, ok: 1, vague: 1, wrong: 0 });
    expect(t.en).toEqual({ n: 1, ok: 0, vague: 0, wrong: 1 });
    expect(t.speak).toEqual({ done: 1, score: null });
    expect(t.review.map((x) => x.g)).toEqual([0, 1]);
  });
});
