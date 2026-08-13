# Product brief: Chốn MVP

## 1. Vấn đề

Các ứng dụng bản đồ hiện tại tìm địa điểm tốt theo tên, danh mục, khoảng cách và rating. Tuy nhiên, chúng trả lời kém các câu hỏi mang tính hoàn cảnh:

- Nơi này có hợp để ngồi một mình vào tối nay không?
- Chiều thứ Bảy quán có đủ yên để làm việc không?
- Đây có phải chỗ phù hợp cho một buổi hẹn ít áp lực không?

Review dài thường cũ, thiếu cấu trúc và không phản ánh sự thay đổi theo thời gian.

## 2. Giả thuyết sản phẩm

Nếu mô tả không khí địa điểm bằng dữ liệu có cấu trúc theo khung giờ, người dùng sẽ chọn nơi nhanh và tự tin hơn so với việc đọc nhiều review.

## 3. Người dùng mục tiêu

### Persona chính: người trẻ sống tại TP.HCM

- 20–35 tuổi.
- Thường đi cà phê, làm việc linh hoạt hoặc gặp bạn bè/hẹn hò.
- Dùng Google Maps nhưng phải đọc ảnh và review để đoán không khí.
- Sẵn sàng chia sẻ đánh giá rất ngắn sau khi ghé quán.

### Ba job-to-be-done của MVP

1. Tìm nơi làm việc phù hợp trong một khung giờ cụ thể.
2. Tìm nơi thoải mái để đi một mình.
3. Tìm địa điểm hẹn hò đúng mức riêng tư và năng lượng mong muốn.

## 4. Giá trị khác biệt

> Chốn cho biết địa điểm nào hợp với bạn vào thời điểm bạn định đến.

Khác biệt cốt lõi:

- Vibe theo ngày và khung giờ.
- Tìm kiếm bằng hoàn cảnh tự nhiên.
- Thu thập tín hiệu ngắn, có cấu trúc.
- Có confidence score cho từng kết quả.
- Các ghi chú vi mô: tầng nào yên, góc nào có ổ điện, giờ nào dễ hết chỗ.

## 5. Phạm vi MVP

### Must have

- Xem bản đồ và danh sách địa điểm.
- Chọn vị trí, bán kính và thời gian dự định ghé.
- Chọn một trong ba mục đích: làm việc, đi một mình, hẹn hò.
- Lọc theo độ ồn, độ đông, ánh sáng, riêng tư, giá và giờ mở cửa.
- Xem trang chi tiết địa điểm và vibe theo khung giờ.
- Lưu địa điểm vào collection.
- Gửi vibe report trong tối đa 10 giây.
- Đăng nhập bằng magic link hoặc OAuth.
- Import seed địa điểm từ CSV đã validate bằng script nội bộ.

### Should have nếu còn thời gian

- Tìm kiếm bằng câu tự nhiên, chuyển thành bộ lọc có cấu trúc.
- Chia sẻ collection công khai.
- Gợi ý một địa điểm theo chế độ “Chọn giúp tôi”.
- Prompt đóng góp sau khi người dùng dự kiến đã ghé.

### Chưa làm trong MVP

- Feed video hoặc mạng xã hội.
- Chat giữa người dùng.
- Native mobile app.
- Gamification phức tạp.
- Quảng cáo trả tiền để tăng vibe score.
- Tự động crawl/sao chép review từ nền tảng khác.
- Phủ toàn bộ TP.HCM hoặc nhiều loại địa điểm.
- Admin Dashboard; seed/correction ban đầu dùng CSV và operational script.

## 6. Vibe taxonomy phiên bản 1

Mỗi chiều dùng thang 1–5 và cho phép chọn “không rõ”:

| Trường | 1 | 5 |
|---|---|---|
| noise | rất yên | rất ồn |
| crowd | rất vắng | rất đông |
| lighting | rất sáng | rất tối/ấm |
| privacy | mở, sát nhau | riêng tư |
| workability | khó làm việc | rất phù hợp |
| social_energy | trầm | sôi động |

Context bổ sung:

- `visit_mode`: một mình, cặp đôi, nhóm, làm việc.
- `seat_availability`: dễ, vừa, khó.
- `area_hint`: trong nhà, ngoài trời, tầng/khu vực tùy chọn.
- `short_note`: tối đa 140 ký tự.

Không mở taxonomy tùy ý trong MVP. Thay đổi taxonomy được quản lý trong code/schema và review như một thay đổi sản phẩm để tránh dữ liệu phân mảnh.

## 7. Nguồn dữ liệu

POI nền đến từ bên thứ ba có điều khoản phù hợp thông qua API/import job. Với dữ liệu nghiệp vụ, Chốn sử dụng taxonomy sau:

| Data type | Mục đích | Được dùng ở đâu |
|---|---|---|
| `synthetic` | Phát triển, test UI/ranking | Local, CI, staging |
| `research` | Trải nghiệm thật thu trong Sprint 0 | Prototype/research |
| `editorial` | Nhóm Chốn xác minh và curate | Production |
| `community` | Người dùng đóng góp trên Chốn | Production |

Không trình bày dữ liệu editorial như dữ liệu cộng đồng. UI phải hiển thị provenance và confidence phù hợp.

Synthetic data không được dùng làm bằng chứng product validation. Research data không được đưa thẳng lên production; chỉ được chuyển thành `editorial` hoặc `community` khi có consent, provenance và xác minh phù hợp.

## 8. Luồng người dùng cốt lõi

### Khám phá

1. Người dùng mở Chốn.
2. Chọn “Tối nay”, vị trí và “Đi một mình”.
3. Điều chỉnh 2–3 preference hoặc dùng mặc định.
4. Nhận danh sách xếp hạng kèm lý do và confidence.
5. Mở chi tiết, lưu hoặc chuyển sang ứng dụng chỉ đường.

### Đóng góp

1. Chọn địa điểm vừa ghé.
2. Chọn thời điểm hiện tại hoặc thời điểm đã ghé.
3. Trả lời 3 câu swipe/tap phụ thuộc mục đích.
4. Thêm ghi chú tùy chọn.
5. Xem đóng góp đã làm confidence của khung giờ tăng thế nào.

## 9. Ranking phiên bản 1

Không dùng ML ở giai đoạn đầu. Dùng weighted score có thể giải thích:

```text
match = sum(dimension_match * preference_weight)
      * confidence_multiplier
      * open_at_multiplier
      * distance_multiplier
```

Mỗi kết quả cần hiển thị 1–3 lý do, ví dụ:

- “Yên hơn 80% địa điểm quanh đây vào sáng Chủ nhật.”
- “Phù hợp làm việc, nhưng thường khó tìm chỗ sau 15:00.”
- “Dữ liệu còn ít: 3 báo cáo trong khung giờ tương tự.”

## 10. Chỉ số thành công trong thử nghiệm kín

### North-star thử nghiệm

Số phiên khám phá dẫn đến hành động có ý định ghé: mở chỉ đường, lưu hoặc chia sẻ.

### Chỉ số 6 tuần đầu

- 100 địa điểm có dữ liệu cơ bản.
- 30 địa điểm có ít nhất 5 vibe report.
- 100 người dùng thử nghiệm.
- Ít nhất 25% phiên khám phá tạo một hành động có ý định ghé.
- Ít nhất 20% người đã đóng góp quay lại đóng góp lần hai.
- Thời gian trung vị hoàn thành vibe report dưới 15 giây.

## 11. Kiểm chứng trước khi mở rộng

Phỏng vấn 10–15 người thuộc persona chính và cho họ thực hiện hai bài test:

1. Tìm quán cho một tình huống cụ thể bằng công cụ hiện tại.
2. Tìm cùng tình huống bằng prototype Chốn.

Chỉ mở rộng địa lý khi phần lớn người thử hiểu ngay lợi ích của “vibe theo thời gian” và dữ liệu hiện có đủ tạo quyết định.
