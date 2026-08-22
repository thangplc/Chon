# UI prototype migration

## Decision

Chốn giữ Next.js + React + Tailwind CSS v4 làm nền styling và dùng shadcn/ui
theo mô hình code-owned components cho các primitive dùng chung. Chốn không
đưa MUI, Ant Design hoặc Chakra UI vào Explore vì các bộ thư viện này mang
theo layout/theme opinionated, khó khớp với bản đồ và detail page riêng của
Chốn.

Native semantic elements (`input`, `select`, `details`, `button`) vẫn được giữ
ở các control phù hợp. UI primitive chỉ gom các phần cần dùng lại như Button,
Badge và Card; điều này giữ accessibility và tránh một lớp abstraction không
cần thiết cho form control.

## Implemented shell

- Header/search và purpose quick bar theo `prototype/wide-app.js`.
- Desktop từ `1180px`: filter sidebar, result list và map thành ba cột.
- Tablet và mobile dưới `1180px`: map đứng trước, bộ lọc nằm trên danh sách
  “Chốn phù hợp”, sau đó là danh sách accessible cuộn tự nhiên.
- Bộ lọc vẫn có thể thu gọn trên mobile; tablet hiển thị bộ lọc inline để không
  che danh sách bằng drawer.
- Result card có thumbnail synthetic, score, reason, confidence/report và link
  chi tiết.
- Desktop giữ header của danh sách trong vùng cuộn riêng để nhiều kết quả không
  làm trôi bản đồ; tablet/mobile dùng cuộn trang tự nhiên.
- Khi chọn card hoặc marker, bản đồ pan tới địa điểm. Desktop hiển thị
  selected-place card ở góc phải phía dưới; tablet/mobile ẩn card nổi và đưa
  `Xem chi tiết` cùng `Góp vibe` vào card đang chọn trong danh sách.
- `Mở chi tiết` điều hướng tới canonical full page; `Góp vibe` mở một modal
  fixed ở ngoài map/list để không bị clipping bởi card hoặc scroll container.
- Selection card desktop mở bằng slide-up/fade `220ms`, đóng bằng slide-down/fade
  `160ms`; người dùng bật reduced motion sẽ không chạy animation.
- Place Detail dùng cùng modal và bảng màu cream/orange của Explore. Font dùng
  một system sans có fallback hỗ trợ đầy đủ tiếng Việt và tiếng Anh.
- Place Detail mobile theo cấu trúc prototype: compact header, gallery, tên và
  trạng thái mở cửa, confidence, lý do phù hợp, vibe bars rồi mới tới facts.
  Tablet/desktop chuyển thành hai cột nhưng giữ nguyên thứ tự đọc semantic.
- Explore giữ `purpose`, ngày và giờ trong link chi tiết để match score và lý do
  được tính từ canonical snapshot đúng context; deep link dùng intent mặc định
  đã chuẩn hóa.
- `Góp vibe` và `Chỉ đường` nằm trong action bar sticky có safe-area trên mobile,
  trở lại flow bình thường trên desktop. Provider bản đồ không xuất hiện trong
  tên CTA.
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
