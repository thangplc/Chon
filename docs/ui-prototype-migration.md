# UI prototype migration

## Decision

Chốn giữ Next.js + React + Tailwind CSS v4 làm nền styling và dùng shadcn/ui
theo mô hình code-owned components cho các primitive dùng chung. Chốn không
đưa MUI, Ant Design hoặc Chakra UI vào Explore vì các bộ thư viện này mang
theo layout/theme opinionated, khó khớp với bản đồ và detail drawer riêng của
prototype.

Native semantic elements (`input`, `select`, `details`, `button`) vẫn được giữ
ở các control phù hợp. UI primitive chỉ gom các phần cần dùng lại như Button,
Badge và Card; điều này giữ accessibility và tránh một lớp abstraction không
cần thiết cho form control.

## Implemented shell

- Header/search và purpose quick bar theo `prototype/wide-app.js`.
- Desktop từ `1180px`: filter sidebar, result list và map thành ba cột.
- Tablet: list/map split view; filter mở dạng drawer từ trái.
- Mobile: map đứng trước, danh sách nằm dạng sheet phía dưới; filter nằm trong
  luồng Explore và có thể mở/ẩn.
- Result card có thumbnail synthetic, score, reason, confidence/report và link
  chi tiết.
- Desktop/tablet giữ header của danh sách trong vùng cuộn riêng để nhiều kết
  quả không làm trôi bản đồ; mobile dùng cuộn trang tự nhiên.
- Khi chọn card hoặc marker, bản đồ pan tới địa điểm và hiển thị selected-place
  card ở góc phải phía dưới với thao tác mở chi tiết hoặc góp vibe.
- Font dùng system sans cho nội dung và system serif cho tên/tiêu đề, cỡ chữ
  card được tăng để đọc tốt hơn trên màn hình nhỏ.
- Dữ liệu, ranking, URL state, analytics, spatial query và fallback accessible
  vẫn dùng code production hiện tại.

## Typography scale

- `xs` / `12px`: metadata, source, confidence và trạng thái phụ.
- `sm` / `14px`: mô tả, reason, filter control và CTA.
- `base` / `16px`: nội dung chính.
- `lg` / `18px`: label/section phụ.
- `display-sm` / `30px`: tiêu đề khu vực như “Chốn phù hợp”.
- `display-md` / `32px`: tên địa điểm nổi bật; card dùng `24px` để giữ nhịp
  danh sách.

Không dùng font-size tùy tiện dưới `12px` cho nội dung người dùng cần đọc.

## Không đưa vào production

- Không copy `prototype/wide-app.js` hoặc dataset hardcode.
- Không thay đổi API, database, auth, provider hoặc ranking contract trong
  migration presentation này.
- Thumbnail hiện tại chỉ là visual placeholder vì Explore contract chưa có
  media; detail page vẫn là nơi hiển thị gallery theo provenance.

## Rollback boundary

Nếu cần rollback visual, revert các thay đổi trong `explore-experience.tsx`,
`globals.css` và `src/components/ui`; domain/API/database không bị ảnh hưởng.
