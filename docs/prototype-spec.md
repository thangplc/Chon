# Mobile prototype specification

## Mục tiêu

Prototype giúp review cấu trúc ba luồng cốt lõi bằng dữ liệu mô phỏng, không kết nối backend và không dùng làm bằng chứng product validation.

## Cách mở

Prototype không cần build hoặc cài dependency:

- Mobile: `prototype/index.html`.
- Tablet: `prototype/tablet.html`.
- Desktop: `prototype/desktop.html`.

## Kích thước mục tiêu

- Thiết kế chính: 390 × 844 px.
- Mobile hỗ trợ từ 320 px trở lên.
- Tablet mục tiêu: 768–1180 px, landscape được ưu tiên.
- Desktop mục tiêu: từ 1180 px trở lên.

## Bố cục theo thiết bị

### Mobile

- Map phía trên, danh sách dạng bottom sheet.
- Map có thể phóng to.
- Filters nằm trong luồng Explore.

### Tablet

- Danh sách và bản đồ split view.
- Filter là drawer mở từ trái để dành không gian cho kết quả.
- Chi tiết địa điểm là floating drawer trên bản đồ.
- Contribution mở trong modal.

### Desktop

- Ba cột: filter sidebar, result list, map.
- Chi tiết địa điểm là floating drawer trên map.
- Map có thể phóng toàn màn hình.
- Contribution mở trong modal ba bước.

## Ba luồng

### 1. Explore

1. Chọn một trong tám mục đích.
2. Chọn khu vực: vị trí hiện tại, tìm kiếm, quận nhanh hoặc map picker + bán kính.
3. Chọn preset thời gian hoặc ngày/giờ chính xác; thời lượng ngồi là tùy chọn.
4. Lọc theo quy mô, tiện ích và khoảng giá nếu cần.
5. Chọn “Tìm Chốn phù hợp”.
6. Xem map phía trên và danh sách dạng bottom sheet.

### 2. Result/detail

1. Mở một kết quả.
2. Xem match score, lý do, cảnh báo và sáu chiều vibe.
3. Xem provenance/confidence.
4. Xem cover + tối đa 5 ảnh và nguồn ảnh.
5. Chọn lưu hoặc quay về kết quả.

### 3. Contribution

1. Chọn “Góp vibe”.
2. Xác nhận mục đích và thời gian.
3. Trả lời ba câu ưu tiên theo purpose.
4. Thêm ghi chú tùy chọn.
5. Gửi và xem trạng thái thành công.

## Màn hình và trạng thái

| ID | Màn hình | Nội dung chính |
|---|---|---|
| P01 | Explore | 8 purpose, location/time, advanced filters |
| P02 | Results | Map + bottom sheet result cards |
| P03 | Empty | Không có kết quả phù hợp |
| P04 | Detail | Score, explanations, vibe dimensions |
| P05 | Low confidence | Cảnh báo dữ liệu còn ít |
| P06 | Contribution context | Place, time, visit mode |
| P07 | Contribution questions | Ba dimension ưu tiên |
| P08 | Contribution note | Ghi chú tùy chọn |
| P09 | Contribution success | Xác nhận report mô phỏng |

## Fixture mapping

- `Góc Mây 01`: thay đổi rõ giữa sáng và tối.
- `Tầng Hai 08`: phù hợp làm việc và riêng tư.
- `Đèn Vàng 05`: phù hợp hẹn hò nhưng đông.
- `Khoảng Lặng 09`: confidence thấp.
- `Nhịp Phố 10`: rất sôi động, phù hợp đi nhóm hơn ba purpose chính.

## Quy tắc nội dung

- Luôn hiển thị banner “Prototype · dữ liệu mô phỏng”.
- Không dùng logo/rating của nền tảng bên thứ ba.
- Không gọi dữ liệu là “đánh giá thật”.
- Match score chỉ nhằm review UI/ranking behavior.
- Không gửi hoặc lưu dữ liệu ra bên ngoài.

## Ngoài phạm vi

- Bản đồ địa lý thật và geocoding thật.
- Auth.
- Provider POI.
- Upload ảnh.
- Đồng bộ database.
- Upload/media storage thật; gallery chỉ là mock visual.
- Share/collection hoàn chỉnh.
- Admin Dashboard.

## Acceptance criteria

- Ba luồng chạy xuyên suốt không cần reload.
- Back navigation không làm mất purpose/time/district đã chọn.
- Cả tám purpose thay đổi thứ tự kết quả và câu hỏi contribution.
- Mobile có map + bottom sheet; map có thể phóng to/thu nhỏ.
- Bộ chọn custom time và map picker có trạng thái tương tác.
- Gallery đổi được ảnh cover và luôn hiển thị nguồn synthetic.
- Có empty state và low-confidence state.
- Keyboard có thể truy cập mọi control.
- Không có request mạng hoặc dependency runtime.
- Desktop giữ ba cột ở viewport từ 1180 px.
- Tablet giữ list/map split view và filter drawer.
