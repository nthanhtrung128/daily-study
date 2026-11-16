import { describe, expect, it } from 'vitest';
import { getSetting } from '../../src/core/db';
import {
  RP_DIALOGUES,
  RP_KEY,
  buildTurns,
  defaultRole,
  hintFor,
  loadHint,
  loadRpStore,
  needsSelfGrade,
  saveHint,
  saveRpRecord,
  summarize,
  turnResult,
  weakTurns,
  type RpDialogue,
  type RpRecord,
} from '../../src/modules/english/roleplay';

const D: RpDialogue = {
  id: 'dl-test',
  title: 'T',
  situation: 'S',
  topic: 'meetings',
  level: 'B1',
  roles: [
    { speaker: 'A', name: 'Quản lý' },
    { speaker: 'B', name: 'Chuyên viên C&B' },
  ],
  lines: [
    { speaker: 'A', en: 'Could you walk me through the numbers?', vi: 'v1' },
    { speaker: 'B', en: 'Sure, here is the summary.', vi: 'v2' },
    { speaker: 'A', en: 'Thanks.', vi: 'v3' },
    { speaker: 'B', en: 'You are welcome.', vi: 'v4' },
    { speaker: 'B', en: 'Anything else?', vi: 'v5' },
  ],
};

describe('lập lượt theo vai', () => {
  it('60 hội thoại đều có vai; vai mặc định là "Chuyên viên C&B" nếu có, không thì vai đầu / vai C&B', () => {
    expect(RP_DIALOGUES).toHaveLength(60);
    for (const d of RP_DIALOGUES) expect(d.roles.map((r) => r.speaker)).toContain(defaultRole(d));
    expect(defaultRole(D)).toBe('B');
    expect(defaultRole({ roles: [{ speaker: 'A', name: 'Ứng viên' }, { speaker: 'B', name: 'Trưởng nhóm C&B' }] })).toBe('B');
    expect(defaultRole({ roles: [{ speaker: 'A', name: 'Ứng viên' }, { speaker: 'B', name: 'Người phỏng vấn' }] })).toBe('A');
  });

  it('giữ thứ tự câu, đánh dấu lượt của người học theo vai đã chọn, gắn tên vai', () => {
    const b = buildTurns(D, 'B');
    expect(b.map((t) => t.mine)).toEqual([false, true, false, true, true]);
    expect(b[0]).toMatchObject({ i: 0, speaker: 'A', name: 'Quản lý', en: D.lines[0]?.en });
    expect(buildTurns(D, 'A').map((t) => t.mine)).toEqual([true, false, true, false, false]);
  });

  it('câu hội thoại thật ≥ 4 từ có id Leitner "en:say:…", câu ngắn thì không', () => {
    const d = RP_DIALOGUES[0] as RpDialogue;
    const turns = buildTurns(d, defaultRole(d));
    for (const t of turns) {
      const long = t.en.trim().split(/\s+/).length >= 4;
      expect(t.sayId).toBe(long ? `en:say:${d.id}:${t.i + 1}` : undefined);
    }
    expect(turns.some((t) => t.sayId)).toBe(true);
  });

  it('luyện lại câu điểm thấp: chỉ giữ lượt yếu kèm câu ngay trước của vai kia', () => {
    const turns = buildTurns(D, 'B');
    expect(weakTurns(turns, [1]).map((t) => t.i)).toEqual([0, 1]);
    expect(weakTurns(turns, [4]).map((t) => t.i)).toEqual([4]);
    expect(weakTurns(turns, [3, 4]).map((t) => t.i)).toEqual([2, 3, 4]);
  });
});

describe('mức gợi ý', () => {
  it('hiện câu / chỉ nghĩa / ẩn hết; đã chấm thì luôn hiện đủ', () => {
    expect(hintFor('full')).toEqual({ en: true, vi: true });
    expect(hintFor('vi')).toEqual({ en: false, vi: true });
    expect(hintFor('none')).toEqual({ en: false, vi: false });
    expect(hintFor('none', true)).toEqual({ en: true, vi: true });
  });
});

describe('chấm lượt + tổng kết phiên', () => {
  const [, t1, , t3, t4] = buildTurns(D, 'B');
  it('có điểm máy → quy ra mức; không có → dùng mức tự đánh giá; không có gì → bỏ qua', () => {
    expect(turnResult(t1!, 95, null)).toMatchObject({ score: 95, g: 2 });
    expect(turnResult(t1!, 70, 2)).toMatchObject({ score: 70, g: 1 });
    expect(turnResult(t1!, null, 0)).toMatchObject({ score: null, g: 0 });
    expect(turnResult(t1!, null, null)).toBeNull();
  });

  it('điểm trung bình chỉ tính lượt máy chấm; câu yếu = chưa "Nhớ rõ", thấp nhất trước', () => {
    const rs = [turnResult(t1!, 100, null)!, turnResult(t3!, 75, null)!, turnResult(t4!, 40, null)!];
    const s = summarize(rs);
    expect(s).toMatchObject({ n: 3, avg: 72 });
    expect(s.weak.map((r) => r.turn.i)).toEqual([4, 3]);
    expect(summarize([])).toEqual({ n: 0, avg: null, weak: [] });
  });

  it('đường dự phòng (tự đánh giá): không có điểm trung bình, Quên / Mơ hồ vào danh sách yếu', () => {
    const s = summarize([turnResult(t1!, null, 2)!, turnResult(t3!, null, 1)!, turnResult(t4!, null, 0)!]);
    expect(s.avg).toBeNull();
    expect(s.weak.map((r) => r.g)).toEqual([0, 1]);
  });

  it('lỗi không hỗ trợ / từ chối quyền / mất mạng → tự đánh giá; không nghe thấy → chỉ cần nói lại', () => {
    for (const e of ['unsupported', 'denied', 'network', 'service', 'audio-capture'] as const) expect(needsSelfGrade(e)).toBe(true);
    for (const e of ['no-speech', 'busy', 'other', null] as const) expect(needsSelfGrade(e)).toBe(false);
  });
});

describe('lưu / đọc kết quả hội thoại (bảng settings)', () => {
  it('lưu lần luyện gần nhất theo id hội thoại, không ghi đè bài khác', async () => {
    expect(await loadRpStore()).toEqual({});
    const r1: RpRecord = { day: '2026-11-16', at: 1, score: 82, role: 'B', n: 5, total: 5 };
    await saveRpRecord('dl-0001', r1);
    await saveRpRecord('dl-0002', { ...r1, score: null, role: 'A' });
    await saveRpRecord('dl-0001', { ...r1, at: 2, score: 91 });
    const s = await loadRpStore();
    expect(s['dl-0001']).toMatchObject({ score: 91, role: 'B', at: 2 });
    expect(s['dl-0002']).toMatchObject({ score: null, role: 'A' });
    expect(await getSetting(RP_KEY, null)).toEqual(s);
  });

  it('mức gợi ý: mặc định "hiện câu", lưu lại được', async () => {
    expect(await loadHint()).toBe('full');
    await saveHint('none');
    expect(await loadHint()).toBe('none');
  });
});
