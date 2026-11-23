---
name: thiet-ke-hoc-tap
description: Thiết kế hoặc rà soát UI/UX cho Daily Study khi thay đổi Hôm nay, lộ trình, bài học, sơ đồ giải thích, luyện nói, phản hồi, nhắc ôn hoặc tiến độ trên iPhone. Dùng cho luồng tương tác và tài liệu thiết kế của dự án.
---

# Thiết kế trải nghiệm học tập

Bắt đầu từ [DESIGN.md](../../../DESIGN.md) và màn hình hiện có. Xác định người học vào từ đâu, họ muốn thực hiện việc gì và dấu hiệu nào cho biết họ đã xong. Đọc mục tương ứng trong [sổ tham khảo](references/nguon.md) để chọn cách thể hiện.

## Thiết kế một lượt học

1. Viết mục tiêu dưới dạng hành vi quan sát được. Ví dụ, sau buổi phản biện, người học có thể đặt một câu hỏi về cách chọn mẫu khảo sát.
2. Nối đường đi ngắn nhất từ Hôm nay đến hành vi đó. Ở bài mới, đưa ngữ cảnh trước lựa chọn. Sau khi người học trả lời, giải thích lý do và cho cơ hội thử nói hoặc áp dụng bằng lời của mình.
3. Thiết kế màn kết quả cùng lúc với bài. Hiện kỹ năng vừa luyện, cách ghi nhận và ngày ôn kế tiếp nếu có. Phân biệt lượt hoàn thành, mức tự đánh giá và bằng chứng nhớ lại sau nhiều ngày.
4. Kiểm tra đường quay lại. Khi từ chối mic vẫn có thể luyện thành tiếng và tự đánh giá. Với lời nhắc, cho xem câu hỏi, giờ và ngày trước khi xuất lịch. Hiện rõ thao tác nào còn cần làm trong ứng dụng Lịch.

## Chọn cách trình bày

| Điều người học muốn biết | Cách thể hiện |
|---|---|
| “Làm gì tiếp?” | Một hành động chính có tên bài. Đặt việc xem toàn bộ lộ trình ở mức phụ. |
| “Tôi đang ở đâu trong sáu buổi?” | Danh sách có thứ tự, chia chặng theo mục tiêu. Viết trạng thái bằng chữ cạnh mỗi bài. |
| “Vì sao ngày ôn thay đổi?” | Mô tả điều kiện chuyển trạng thái và lấy một ví dụ có ngày. Khi dùng sơ đồ, cung cấp cùng nội dung dưới dạng văn bản. |
| “Lần sau tôi có làm tốt hơn?” | Đặt hai lần làm cùng nhiệm vụ vào hai ngày cạnh nhau. Ghi tiêu chí và nguồn đánh giá. |
| “Dùng mẫu giao diện nào?” | Chọn một đặc điểm phục vụ nhiệm vụ như phân cấp tiêu đề hoặc nhóm nút. Áp dụng bằng token và component có sẵn của Daily Study. |

## Rà soát bản chạy

Thử lối vào thực tế trên iPhone SE và iPhone 14. Với màn đọc, thử chữ lớn và giao diện tối. Với màn tương tác, kiểm tra thứ tự focus, vùng chạm, thông báo khi lưu và lần mở lại. Dùng `tests/e2e/helpers/audit.ts` để đo vùng chạm, tương phản và tràn ngang. Với tính năng dùng ngoại tuyến, mở lần đầu khi có mạng, chờ service worker sẵn sàng rồi tải lại khi mất mạng.

Tra cứu thêm bằng `rg -in 'Touch|Focus|Progress|Error' .agents/skills/thiet-ke-hoc-tap/references/ux-guidelines.csv` từ gốc repo. Khi báo cáo, ghi màn hình, cách tái hiện, ảnh hoặc số đo và thay đổi đã kiểm lại.
