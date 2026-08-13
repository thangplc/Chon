# Chốn

**Chốn** là bản đồ khám phá quán cà phê tại TP.HCM theo tâm trạng, hoàn cảnh và thời điểm — thay vì chỉ theo tên hoặc danh mục.

Ví dụ truy vấn:

- Một quán yên tĩnh để làm việc một mình vào sáng Chủ nhật.
- Chỗ hẹn đầu tiên, ánh sáng ấm và không quá ồn.
- Quán mở muộn, có thể ngồi một mình mà không ngại.

## Trạng thái

Dự án đang ở giai đoạn lập kế hoạch MVP.

Ba tài liệu cần chốt trước khi viết code:

- [Context sản phẩm](CONTEXT.md)
- [Plan phát triển](PLAN.md)
- [Tech stack](TECH_STACK.md)

Tài liệu chi tiết hỗ trợ:

- [Product brief](docs/product-brief.md)
- [Kiến trúc và dữ liệu](docs/architecture.md)
- [Roadmap theo sprint](ROADMAP.md)

## Trạng thái quyết định

Chưa bắt đầu implementation. Context, plan và tech stack đang là đề xuất cần review; các quyết định chưa được xem là cố định cho tới khi được chốt.

## Phạm vi MVP đề xuất

- Khu vực: Quận 1, Quận 3 và Bình Thạnh, TP.HCM.
- Danh mục: quán cà phê.
- Tình huống: làm việc, đi một mình và hẹn hò.
- Dữ liệu ban đầu: 50–100 địa điểm được curate.
- Nền tảng: responsive web/PWA.

## Nguồn dữ liệu MVP

- POI nền lấy từ provider bên thứ ba có điều khoản phù hợp.
- Founder/curator xác minh seed bằng CSV; developer chạy validation/import script.
- Vibe cộng đồng được thu trực tiếp từ người dùng trên Chốn.
- Admin Dashboard không thuộc MVP và chỉ được cân nhắc sau beta.

| Data type | Mục đích | Môi trường |
|---|---|---|
| `synthetic` | Phát triển và kiểm thử | Local, CI, staging |
| `research` | Trải nghiệm thật trong Sprint 0 | Prototype/research |
| `editorial` | Nhóm Chốn xác minh và curate | Production |
| `community` | Người dùng đóng góp trên Chốn | Production |

Synthetic và research không được import trực tiếp vào production.

## Nguyên tắc sản phẩm

1. Vibe thay đổi theo khung giờ, không phải thuộc tính cố định.
2. Đóng góp phải hoàn thành trong khoảng 10 giây.
3. Hiển thị độ tin cậy, không giả vờ dữ liệu ít là chính xác.
4. Không bán điểm vibe hoặc thứ hạng tự nhiên cho địa điểm.
5. Bắt đầu nhỏ với dữ liệu sâu trước khi mở rộng địa lý.
