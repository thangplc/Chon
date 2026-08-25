# Explore URL sharing và analytics

## URL chia sẻ

Explore đồng bộ bộ lọc đã áp dụng vào query string canonical bằng
`history.replaceState`, nên đổi bộ lọc không reload trang. Các control metadata
chỉ là trạng thái đang chọn cho đến khi người dùng bấm `Áp dụng bộ lọc`; lúc đó
frontend gọi `/api/explore/simulated` và chỉ cập nhật URL sau khi API thành công.
Các tham số hiện được hỗ trợ:

```text
purpose, date, time, duration
area=<service-area-code>
q, size, amenities, price_levels, price_range
```

`district=q1|q3|binh_thanh` vẫn được đọc để tương thích link cũ, nhưng URL mới
luôn được canonicalize sang `area=hcm-q1|hcm-q3|hcm-binh-thanh`. Danh sách mã
khu vực không hard-code ở frontend mà lấy từ service area active trong DB.

Khi mở lại URL, frontend hydrate các bộ lọc và tìm các địa điểm phù hợp với
`q` trong dataset hiện tại. Tọa độ vị trí hiện tại/chọn trên bản đồ không được
lưu vào URL; điều này tránh chia sẻ vị trí riêng tư và tránh tạo một link không
thể tái lập nếu dữ liệu spatial thay đổi.

Nút `Chia sẻ bộ lọc` sao chép URL hiện tại qua Clipboard API. Nếu clipboard
không khả dụng, UI báo lỗi và không làm gián đoạn luồng Explore.

## Analytics contract

Frontend tạo một anonymous session ID trong `sessionStorage` và chỉ gửi các
event được allowlist:

- `explore_results_viewed`
- `explore_filter_changed`
- `explore_share_clicked`
- `place_save_succeeded`
- `collection_share_clicked`
- `directions_opened`

Payload chỉ chứa context đã chuẩn hóa: mục đích, khung giờ/ngày, thời lượng,
khu vực, số lượng filter metadata và số kết quả; hoặc ID/slug, loại collection,
bề mặt thao tác và provider chỉ đường thuộc allowlist. Không gửi raw search
text, tọa độ, identity hoặc nội dung report. Event được gửi bằng `sendBeacon`,
fallback sang `fetch(..., { keepalive: true })`; lỗi analytics không làm hỏng
luồng chính của người dùng.

Browser gọi same-origin `POST /api/analytics/events`; Next.js proxy chuyển
tiếp tới `POST /v1/analytics/events` của NestJS. API validate lại bằng shared
Zod contract trước khi ghi `analytics_events`. Migration là
`apps/api/drizzle/0009_organic_human_fly.sql`.

Analytics hiện là nền tảng đo Explore, hành vi lưu/chia sẻ collection và mở chỉ
đường; chưa có retention/aggregation dashboard. Khi triển khai production cần
bổ sung retention policy, access control và rate limit theo traffic thực tế.
