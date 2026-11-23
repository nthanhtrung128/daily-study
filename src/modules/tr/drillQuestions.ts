import type { Skill } from '../../core/skillDrills';
import { readAmount } from './raiseBudget';

type Question = { prompt: string; choices?: readonly string[]; answer: string; why: string };
export const skillNames: Record<Skill, string> = {
  scope: 'Đối chiếu phạm vi công việc', budget: 'Chọn phương án vừa quỹ', decision: 'Bảo vệ đề xuất bằng chứng cứ',
  freshness: 'Kiểm tra tuổi và mẫu khảo sát', retention: 'Tách giữ người khỏi đối sánh',
  inYear: 'Tính chi phí trong năm', full: 'Tính chi phí tăng đủ 12 tháng', assumptions: 'Kiểm chứng giả định ngân sách',
};

const scenarios = {
  scope: [
    ['Tổ trưởng một kho chỉ trình duyệt chi. Nên dùng nguồn nào trước?', 'Điều phối một kho, trình duyệt chi', 'Cùng chức danh, duyệt chi bốn kho', 'Chọn theo quyền hạn và phạm vi thực hiện.'],
    ['Vị trí mới phê duyệt chi tiêu của ba chi nhánh. Hồ sơ nào sát hơn?', 'Quản lý nhiều điểm, có quyền duyệt', 'Trưởng nhóm một điểm, chỉ đề xuất chi', 'Đối chiếu số đơn vị phụ trách và quyền quyết định.']],
  freshness: [
    ['Mẫu phù hợp đã 14 tháng. Bước nào giúp cập nhật giá trị tham chiếu?', 'Kiểm tra kỳ dữ liệu và biến động lương của đúng nhóm việc', 'Cộng ngay mức lạm phát chung', 'Biến động giá tiêu dùng chưa thể thay cho biến động lương của nhóm việc.'],
    ['Cùng phạm vi nhưng trung vị mới chỉ do ba công ty cung cấp. Hỏi gì trước?', 'Hỏi cỡ mẫu và mức tập trung của dữ liệu', 'Hỏi xem tiêu đề báo cáo có chữ mới nhất không', 'Mẫu ít hoặc tập trung có thể làm mức tham chiếu thiếu đại diện.']],
  retention: [
    ['Nhân viên chủ chốt nhận lời mời cao hơn. Xử lý nguồn tham chiếu thế nào?', 'Giữ nguồn sát công việc, trình riêng lý do giữ người', 'Đổi sang hồ sơ vùng quản lý rộng hơn để khớp giá mời', 'Rủi ro mất người có thể biện minh cho ngoại lệ, nhưng phạm vi công việc vẫn như cũ.'],
    ['Trưởng phòng muốn lấy lương giám đốc làm chuẩn giữ chuyên viên. Bạn đề nghị gì?', 'Định giá công việc hiện tại rồi lập hồ sơ ngoại lệ', 'Đổi chuẩn theo người có lương cao nhất phòng', 'Tách chuẩn của vị trí khỏi quyết định giữ cá nhân.']],
  decision: [
    ['Ba người rời nhóm, một người nhắc lương. Kết luận nào nên trình giám đốc?', 'Kiểm tra lương và nguyên nhân khác trước khi duyệt chi', 'Cả ba nghỉ vì lương nên tăng ngay', 'Một lời kể gợi hướng kiểm chứng, chưa đủ quy nguyên nhân cho toàn nhóm.'],
    ['Sau khi đổi ca, số người xin nghỉ giảm trong một tháng. Nên kết luận gì?', 'Đề nghị theo dõi thêm theo quý và đối chiếu các thay đổi đồng thời', 'Chốt rằng đổi ca là nguyên nhân duy nhất', 'Khoảng thời gian ngắn và yếu tố đồng thời hạn chế kết luận nhân quả.']],
  assumptions: [
    ['Năm sau dự kiến tuyển thêm năm người. Có thể dùng nguyên chi phí đủ năm hiện tại không?', 'Tách chi phí người hiện tại và lập lịch vào làm của người mới', 'Nhân chi phí quý cuối với bốn rồi chốt', 'Định biên và thời điểm vào làm tác động đến ngân sách năm sau.'],
    ['Mười nhân sự sẽ chuyển bộ phận vào tháng 4. Cần xác nhận gì trước khi chốt ngân sách?', 'Thời điểm chuyển và đơn vị chịu chi phí theo từng tháng', 'Chỉ cần tỷ lệ tăng cũ', 'Đơn vị chịu chi phí và số tháng hưởng quyết định quỹ của từng bộ phận.']],
} as const;

export function drillQuestion(skill: Skill, index: number): Question {
  if (skill === 'full' || skill === 'inYear' || skill === 'budget') {
    const people = 12 + 4 * (index % 7);
    const month = 8 + index % 4;
    const monthly = people; // 25 triệu × 4% = 1 triệu/người/tháng.
    const year = monthly * (13 - month);
    const base = people + ' người, lương 25 triệu/người/tháng, tăng 4% từ đầu tháng ' + month + '. ';
    if (skill === 'full') return { prompt: base + 'Giữ nguyên nhân sự. So với nền lương cũ, đủ 12 tháng tăng bao nhiêu triệu đồng?',
      answer: String(monthly * 12), why: monthly + ' triệu/tháng × 12 = ' + monthly * 12 + ' triệu đồng.' };
    if (skill === 'inYear') return { prompt: base + 'Trong năm hiện tại tăng bao nhiêu triệu đồng?',
      answer: String(year), why: monthly + ' triệu/tháng × ' + (13 - month) + ' tháng = ' + year + ' triệu đồng.' };
    return { prompt: base + 'Quỹ năm nay là ' + (year - 5) + ' triệu. Nếu lùi áp dụng đúng một tháng, quỹ còn bao nhiêu triệu?',
      answer: String(monthly - 5), why: 'Chi ' + (year - monthly) + ' triệu thay vì ' + year + ' triệu, nên còn ' + (monthly - 5) + ' triệu.' };
  }
  const [prompt, right, wrong, why] = scenarios[skill][index % 2]!;
  return { prompt, choices: index % 2 === 0 ? [wrong, right] : [right, wrong], answer: right, why };
}

export function matchesQuestion(q: Question, value: string) {
  return q.choices ? value === q.answer : readAmount(value) === Number(q.answer);
}
