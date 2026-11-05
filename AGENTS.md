# AGENTS.md

Hướng dẫn cho mọi trợ lý lập trình (Codex, Claude Code, …) làm việc trên repo này.

**Quy tắc đầy đủ nằm trong [CLAUDE.md](CLAUDE.md): đọc và tuân theo file đó trước khi làm bất cứ việc gì.** Tên file là của Claude Code nhưng nội dung áp dụng cho mọi trợ lý.

Đọc tiếp, theo thứ tự:
1. [docs/HANDOFF.md](docs/HANDOFF.md): hiện trạng app, các quyết định đã chốt, việc còn lại.
2. [docs/PLAN.md](docs/PLAN.md): kế hoạch và các phiên đã làm.
3. [docs/DEPLOY.md](docs/DEPLOY.md): deploy và danh sách kiểm tra trên iPhone.

Tóm tắt điều bắt buộc (chi tiết ở CLAUDE.md):
- Giao diện, commit message, mô tả PR: tiếng Việt.
- Không sửa `legacy/` và `content/tr101/data.json` (dữ liệu nội bộ, không đưa ra ngoài).
- Không thêm analytics, tracker, script hay CDN bên ngoài; dữ liệu người dùng chỉ lưu trên máy (IndexedDB).
- Không đổi các số liệu pháp lý 2026 khi người dùng chưa xác nhận.
- Mỗi việc một nhánh, một PR. Trước khi mở PR chạy:
  `npm run lint && npm run typecheck && npm test && npm run build && npm run validate:content` và `npm run test:e2e`.
- Không skip/tắt test để cho xanh.
