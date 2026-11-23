---
version: alpha
name: Daily Study
description: Sổ học Total Rewards và tiếng Anh giao tiếp trên iPhone.
colors:
  light:
    bg: "#eef1f4"
    surface: "#ffffff"
    ink: "#14202b"
    muted: "#5a6776"
    accent: "#1d5bc4"
    accent-ink: "#ffffff"
  dark:
    bg: "#0e1318"
    surface: "#151c24"
    ink: "#e5eaf0"
    muted: "#95a2b0"
    accent: "#7fa6ff"
    accent-ink: "#0b1220"
---

# Daily Study

## Bố cục và chữ

Người học thường mở từ Màn hình chính iPhone để học ngắn giữa hai việc. Giữ một cột đọc, lề hai bên ít nhất 16 px và vùng nội dung rộng tối đa 760 px. Khi người học tăng cỡ chữ, cho tiêu đề, nút và nhãn trạng thái xuống dòng. Dùng Be Vietnam Pro cho điều hướng, Source Serif 4 cho nội dung thẻ và IBM Plex Mono cho các con số cần đối chiếu. Các họ chữ đều có phương án dự phòng trên máy.

## Màu và thao tác

Dùng `--surface` trên nền `--bg`, `--ink` cho nội dung và `--muted` cho chú thích. Nút hành động chính dùng cặp `--accent` và `--accent-ink`. Viết rõ “Đến hạn ôn” hoặc “Đã lưu” ngay cả khi trạng thái đã có màu riêng. Ở giao diện tối, dùng cùng tên biến để màu đổi theo lựa chọn của người học. Đối chiếu với định nghĩa đang chạy mỗi khi đổi bộ màu. [CSS của ứng dụng](src/ui/styles.css)

Dùng `--tap` cho đích chạm, tối thiểu 44 × 44 px. Một lượt trả lời có thể thay hẳn phần nội dung bên dưới. Khi đó chuyển focus đến tiêu đề phản hồi và cho biết kết quả đã lưu hay còn cần thao tác. Khi micro hoặc mạng chưa sẵn sàng, chỉ ra cách người học có thể hoàn thành ngay trên thiết bị.

## Ngôn ngữ học tập

Dùng động từ gắn với công việc sắp làm, chẳng hạn “Ôn lại · Tách quan sát khỏi kết luận”. Cho người đọc mở nghĩa tiếng Việt của câu tiếng Anh khi cần. Với một lần luyện nói, kết hợp lựa chọn lời đáp, phản hồi có lý do và tiêu chí tự kiểm cụ thể. Ghi rõ ngày, tiêu chí và người đánh giá khi so sánh tiến độ.
