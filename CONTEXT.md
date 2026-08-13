# Context sản phẩm: Chốn

## 1. Tầm nhìn

Chốn là bản đồ giúp người dùng tìm một nơi phù hợp với tâm trạng, hoàn cảnh và thời điểm.

Tầm nhìn dài hạn:

> Trở thành lớp dữ liệu về “không khí đô thị” — cho biết một nơi mang lại trải nghiệm gì, vào lúc nào và phù hợp với ai.

## 2. Vấn đề cần giải quyết

Các sản phẩm bản đồ phổ biến tối ưu cho câu hỏi “địa điểm nào ở gần và được đánh giá cao?”. Người dùng vẫn phải tự đọc review, xem ảnh rồi suy đoán khi câu hỏi là:

- Quán nào đủ yên để làm việc vào chiều cuối tuần?
- Đi một mình vào buổi tối ở đâu sẽ thoải mái?
- Nơi nào phù hợp cho buổi hẹn đầu tiên nhưng không quá trang trọng?

Rating tổng hợp không trả lời tốt vì:

- Không khí thay đổi theo ngày và giờ.
- Hai người có thể cùng đánh giá tốt nhưng tìm kiếm trải nghiệm khác nhau.
- Review dài thiếu cấu trúc, nhanh cũ và tốn thời gian đọc.

## 3. Product thesis

Ba giả định cốt lõi cần kiểm chứng:

1. “Phù hợp với hoàn cảnh” có giá trị hơn một rating chung khi chọn nơi để đến.
2. Không khí có thể biểu diễn đủ hữu ích bằng một số chiều có cấu trúc theo thời gian.
3. Người dùng sẵn sàng đóng góp tín hiệu ngắn nếu thao tác mất dưới 15 giây và thấy tác động của đóng góp.

Nếu một trong ba giả định không đúng, cần điều chỉnh sản phẩm trước khi mở rộng.

## 4. Đối tượng ban đầu

Người 20–35 tuổi đang sống tại TP.HCM, thường xuyên đi cà phê và có ít nhất một trong các nhu cầu:

- Làm việc/học tập ngoài nhà.
- Đi một mình.
- Hẹn hò hoặc trò chuyện riêng tư.

Không ưu tiên khách du lịch trong MVP vì nhóm này khó tạo vòng lặp đóng góp lặp lại.

## 5. Định vị

### Một câu mô tả

> Chốn giúp bạn tìm quán cà phê hợp với mình vào đúng thời điểm định đến.

### Không phải

- Một bản sao Google Maps.
- Một feed video review địa điểm.
- Một mạng xã hội check-in.
- Một nền tảng quảng cáo cho quán.
- Một chatbot gợi ý địa điểm chung chung.

## 6. Lợi thế sản phẩm dự kiến

- Vibe theo khung giờ, không phải nhãn cố định.
- Dữ liệu có cấu trúc và có confidence.
- Ranking theo mục đích cụ thể, có lý do giải thích.
- Ghi chú vi mô như khu vực nào yên hoặc thời điểm nào khó tìm chỗ.
- Dữ liệu cộng đồng do Chốn sở hữu và có thể cải thiện dần.

## 7. Nguồn dữ liệu và quyền sở hữu

Chốn chốt bốn loại dữ liệu nghiệp vụ:

| Data type | Mục đích | Được dùng ở đâu |
|---|---|---|
| `synthetic` | Phát triển, test UI/ranking | Local, CI, staging |
| `research` | Trải nghiệm thật thu trong Sprint 0 | Prototype/research |
| `editorial` | Nhóm Chốn xác minh và curate | Production |
| `community` | Người dùng đóng góp trên Chốn | Production |

`data_type` mô tả mức độ và mục đích sử dụng các report do Chốn tạo hoặc thu trực tiếp. POI và tín hiệu vibe bên thứ ba được quản lý riêng bằng provenance/provider mapping, không phải loại dữ liệu thứ năm.

Mô hình đã chốt:

```text
POI bên thứ ba  → provider provenance → canonical place
Vibe bên thứ ba → provider provenance → provider vibe signal
Dữ liệu Chốn    → data_type           → vibe report/amenities/media
```

### POI từ bên thứ ba

- Tên, địa chỉ, tọa độ, loại địa điểm, giờ mở cửa và thông tin liên hệ.
- Provider architecture đã chốt trong Sprint 1: FSQ OS Places cho POI snapshot/delta, MapTiler cho tile/geocoding và Geoapify làm fallback; production vẫn cần credential coverage smoke test.
- Ranh giới `service_area` lấy từ OpenStreetMap: bản GeoJSON nguồn được version hóa trong S3-compatible object storage; bản đã validate/simplify được lưu trong PostGIS để query runtime.
- Dữ liệu được import/đồng bộ vào database theo điều khoản của provider.
- Chốn dùng ID nội bộ; ID của provider chỉ dùng để mapping nguồn.

### Tín hiệu vibe từ bên thứ ba

- Kết hợp bốn provider candidate: Foursquare Places Pro/Premium, Google Places, Yelp và Tripadvisor.
- Chỉ tích hợp qua API/dataset hoặc thỏa thuận cấp phép chính thức; không scrape review, ảnh hoặc nội dung hiển thị công khai.
- Các nguồn này cung cấp tín hiệu bổ trợ như rating, review/review summary, tips/tastes, popular hours, popularity, price, amenities và ảnh; không được xem là một `vibe_report` do người dùng Chốn trực tiếp ghi nhận.
- Tín hiệu được chuẩn hóa vào kho riêng, gắn provider, provider place ID, thời gian lấy, phạm vi thời gian nếu có, attribution, chính sách lưu trữ và confidence.
- Tín hiệu không có thời điểm trải nghiệm chỉ được dùng như đặc trưng tổng quát. Không tự gán vào `day_type`/`time_bucket` cụ thể.
- Provider signal dùng để cold-start, bổ trợ giải thích và giảm khoảng trống dữ liệu; không ghi đè report `editorial` hoặc `community` đã xác minh.
- Mỗi adapter chỉ được bật sau khi vượt qua gate về credential, coverage TP.HCM, chi phí, attribution và quyền lưu/biến đổi dữ liệu.

### Seed thủ công

- 50–100 địa điểm đầu tiên được founder/nhóm dự án xác minh và curate.
- Trong MVP, dữ liệu được chuẩn bị bằng file CSV có schema cố định rồi import bằng script.
- Không xây Admin Dashboard trong giai đoạn này.
- Vibe do nhóm dự án ghi nhận phải mang nhãn `editorial`, kèm người nhập, nguồn và thời điểm xác minh.

### Dữ liệu phát triển và nghiên cứu

- `synthetic` là dữ liệu giả lập để bao phủ use case, edge case, kiểm thử UI, ranking và hiệu năng; không phải bằng chứng validation.
- `research` là trải nghiệm thật do người tham gia cung cấp trong Sprint 0; dùng cho prototype và phân tích nghiên cứu.
- `research` không tự động trở thành dữ liệu production. Muốn chuyển sang `editorial` hoặc `community` phải có sự đồng ý, đủ provenance và qua bước xác minh tương ứng.
- `synthetic` bị cấm trong production.

### Vibe cộng đồng

- Thu trực tiếp từ người dùng trên web/PWA Chốn chuẩn bị xây.
- Review/tín hiệu từ nền tảng khác không được gắn nhãn `community`; chúng chỉ đi qua pipeline provider riêng khi có quyền sử dụng.
- Report gắn với địa điểm, thời điểm ghé, khung giờ và mức xác minh vị trí.
- Đây là dữ liệu first-party do Chốn thu thập và quản lý theo chính sách riêng tư của sản phẩm.

## 8. Phạm vi thử nghiệm đầu tiên

- Thành phố: TP.HCM.
- Khu vực đề xuất: Quận 1, Quận 3, Bình Thạnh.
- Ba khu vực là các bản ghi cấu hình trong `service_areas`, không hard-code vào business logic; mở rộng bằng boundary version mới và kích hoạt trong database.
- Loại địa điểm: quán cà phê.
- Use case: làm việc, học/đọc, đi một mình, hẹn hò, gặp bạn bè, họp công việc, thư giãn và đi khuya.
- Quy mô dữ liệu: 50–100 địa điểm curate.
- Nền tảng: responsive web/PWA.

## 9. Ràng buộc

- Một developer, cần giữ kiến trúc đơn giản.
- Cold start dữ liệu là rủi ro lớn hơn độ khó kỹ thuật.
- Không phụ thuộc vào việc scrape review hoặc ảnh không có quyền sử dụng; thiếu một provider vibe không được làm hỏng core flow.
- Seed MVP chỉ được cập nhật qua file CSV và import script có kiểm tra; Admin Dashboard được hoãn sang giai đoạn sau.
- Local, CI và staging phải tách biệt với production; production importer phải từ chối `data_type=synthetic` và `data_type=research`.
- Không thu thập lịch sử vị trí liên tục.
- Không bán thứ hạng hoặc vibe score.
- Chưa mở rộng địa lý trước khi dữ liệu tại khu vực thử nghiệm đủ sâu.
- Các hoạt động collect/phỏng vấn/usability test đang được hoãn. Dự án có thể tiếp tục technical prototype nhưng chưa được xem là đã product validation.

## 10. Tiêu chí chứng minh ý tưởng

Trong beta, ý tưởng được xem là có tín hiệu khi:

- Người dùng hiểu giá trị “vibe theo thời gian” mà không cần giải thích dài.
- Ít nhất 25% phiên khám phá dẫn tới lưu, chia sẻ hoặc mở chỉ đường.
- Người dùng hoàn thành một vibe report trong trung vị dưới 15 giây.
- Ít nhất 20% contributor quay lại đóng góp lần thứ hai.
- Có ít nhất 30 địa điểm với dữ liệu đủ tạo quyết định hữu ích.

## 11. Câu hỏi chưa chốt

1. Tên “Chốn” có được giữ làm tên chính thức không?
2. Ba khu vực thử nghiệm có thuận tiện cho việc curate thực địa không?
3. Sáu chiều vibe hiện tại có dễ hiểu và đủ phân biệt không?
4. Vibe report có bắt buộc xác minh gần địa điểm hay chỉ được tăng trọng số?
5. Người dùng thích bắt đầu bằng mood, mục đích hay câu tìm kiếm tự nhiên?
