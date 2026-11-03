import { describe, expect, it } from 'vitest';
import { align, bestOf, gradeForScore, intToWords, normalize, numberWords, scoreSpeech, tokenize } from '../../src/modules/english/speech/score';

describe('chuẩn hóa', () => {
  it('chữ hoa, dấu câu, nháy cong', () => {
    expect(normalize('Hello, World!')).toBe('hello world');
    expect(normalize('“Could you help me?”')).toBe('could you help me');
    expect(normalize('I’m fine.')).toBe('i am fine');
  });

  it('viết tắt thường gặp', () => {
    expect(normalize("I'm")).toBe('i am');
    expect(normalize("don't")).toBe('do not');
    expect(normalize("won't can't cannot")).toBe('will not can not can not');
    expect(normalize("we're they've you'll")).toBe('we are they have you will');
    expect(normalize("let's")).toBe('let us');
    expect(normalize('gonna wanna')).toBe('going to want to');
    expect(normalize("company's policy")).toBe('companys policy');
  });

  it('gạch nối, ok/okay, email, -ise/-ize, a.m.', () => {
    expect(normalize('follow-up')).toBe('follow up');
    expect(normalize('Okay')).toBe('ok');
    expect(normalize('e-mail')).toBe('email');
    expect(normalize('organise')).toBe(normalize('organize'));
    expect(normalize('9 a.m.')).toBe('nine am');
  });

  it('số → chữ', () => {
    expect(intToWords(0)).toEqual(['zero']);
    expect(intToWords(15).join(' ')).toBe('fifteen');
    expect(intToWords(1530).join(' ')).toBe('one thousand five hundred thirty');
    expect(intToWords(12_000_000).join(' ')).toBe('twelve million');
    expect(numberWords('12.5')?.join(' ')).toBe('twelve point five');
    expect(numberWords('15%')?.join(' ')).toBe('fifteen percent');
    expect(numberWords('$200')?.join(' ')).toBe('two hundred dollars');
    expect(numberWords('3rd')?.join(' ')).toBe('third');
    expect(numberWords('21st')?.join(' ')).toBe('twenty first');
    expect(numberWords('20th')?.join(' ')).toBe('twentieth');
    expect(numberWords('9:30')?.join(' ')).toBe('nine thirty');
    expect(numberWords('10:00')?.join(' ')).toBe('ten');
    expect(numberWords('1,530')?.join(' ')).toBe('one thousand five hundred thirty');
    expect(numberWords('50k')?.join(' ')).toBe('fifty thousand');
    expect(numberWords('abc')).toBeNull();
    expect(normalize('one hundred and fifty')).toBe(normalize('150'));
  });

  it('mỗi token nhớ từ hiển thị gốc', () => {
    expect(tokenize("I'm late").map((t) => t.src)).toEqual([0, 0, 1]);
  });
});

describe('căn chỉnh theo từ', () => {
  it('khớp hết / thay / xóa / chèn', () => {
    const ops = (a: string, b: string) => align(tokenize(a), tokenize(b)).map((o) => o.op).join(',');
    expect(ops('a b c', 'a b c')).toBe('ok,ok,ok');
    expect(ops('a b c', 'a x c')).toBe('ok,sub,ok');
    expect(ops('a b c', 'a c')).toBe('ok,del,ok');
    expect(ops('a b c', 'a b x c')).toBe('ok,ok,ins,ok');
    expect(ops('a b', '')).toBe('del,del');
    expect(ops('', 'a')).toBe('ins');
  });
});

describe('chấm điểm câu nói', () => {
  const T = "I'm running a bit behind on the payroll reconciliation, but I'll have it done by Friday.";

  it('nói đúng (khác hoa thường, dấu câu, viết tắt) → 100%', () => {
    const r = scoreSpeech(T, 'I am running a bit behind on the payroll reconciliation but I will have it done by Friday');
    expect(r.score).toBe(100);
    expect(r.words.every((w) => w.status === 'ok')).toBe(true);
  });

  it('từ sai được tô sai, ghi từ nghe được', () => {
    const r = scoreSpeech('Could you send me the report today?', 'could you send me the export today');
    const w = r.words.find((x) => x.text === 'report');
    expect(w?.status).toBe('wrong');
    expect(w?.heard).toBe('export');
    expect(r.sub).toBe(1);
    expect(r.score).toBe(Math.round((6 / 7) * 100));
  });

  it('từ thiếu', () => {
    const r = scoreSpeech('Could you send me the report today?', 'could you send the report');
    expect(r.words.filter((w) => w.status === 'missing').map((w) => w.text)).toEqual(['me', 'today?']);
    expect(r.del).toBe(2);
  });

  it('từ thừa trừ nửa điểm, gắn vào trước từ kế tiếp hoặc cuối câu', () => {
    const r = scoreSpeech('Thanks for your help', 'thanks so much for your help today');
    expect(r.ins).toBe(3);
    expect(r.words[1]?.extraBefore).toEqual(['so', 'much']);
    expect(r.extraAfter).toEqual(['today']);
    expect(r.score).toBe(Math.round(((4 - 1.5) / 4) * 100));
  });

  it('bỏ từ đệm um/uh', () => {
    expect(scoreSpeech('Let me check', 'um let me uh check').score).toBe(100);
  });

  it('số viết bằng chữ hay chữ số đều khớp', () => {
    expect(scoreSpeech('The bonus is 15% of base salary.', 'the bonus is fifteen percent of base salary').score).toBe(100);
    expect(scoreSpeech('We have three options.', 'we have 3 options').score).toBe(100);
  });

  it("'s = is hoặc has", () => {
    expect(scoreSpeech("He's been here for two years.", 'he has been here for 2 years').score).toBe(100);
    expect(scoreSpeech("How's the report coming along?", 'how is the report coming along').score).toBe(100);
  });

  it('một từ đích gồm nhiều token, sai một phần → sai', () => {
    const r = scoreSpeech("I'm ready", 'I was ready');
    expect(r.words[0]?.status).toBe('wrong');
    expect(r.words[1]?.status).toBe('ok');
  });

  it('không nói gì → 0%, tất cả thiếu; nói lạc đề → điểm không âm', () => {
    const r = scoreSpeech('Good morning everyone', '');
    expect(r.score).toBe(0);
    expect(r.words.every((w) => w.status === 'missing')).toBe(true);
    expect(scoreSpeech('Hi', 'completely different words here and there').score).toBe(0);
  });

  it('chọn phương án nhận giọng khớp nhất', () => {
    expect(bestOf('I need the headcount report', ['I need the head count report', 'I need the headcount report']).score).toBe(100);
    expect(bestOf('x', []).score).toBe(0);
  });
});

describe('chấm Leitner theo điểm', () => {
  it('≥90 nhớ rõ, 60–89 mơ hồ, <60 quên', () => {
    expect(gradeForScore(100)).toBe(2);
    expect(gradeForScore(90)).toBe(2);
    expect(gradeForScore(89)).toBe(1);
    expect(gradeForScore(60)).toBe(1);
    expect(gradeForScore(59)).toBe(0);
    expect(gradeForScore(0)).toBe(0);
  });
});
