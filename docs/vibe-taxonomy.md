# Vibe taxonomy v1

Trạng thái: **approved v1 — 2026-08-13**. Đây vẫn là giả thuyết sản phẩm, chưa được kiểm chứng với người dùng thật.

## Nguyên tắc

- Mỗi chiều dùng thang 1–5; `null` nghĩa là người dùng chọn “Không rõ”.
- Điểm mô tả trạng thái tại thời điểm ghé, không phải chất lượng cố định của quán.
- Không dùng một chiều để thay thế rating tốt/xấu.
- UI hiển thị từ ngữ; số chỉ dùng trong lưu trữ và tính toán.
- Người đóng góp chỉ cần trả lời 3 câu ưu tiên theo `visit_mode`; sáu chiều đầy đủ là tùy chọn.

## Sáu chiều chính

| Field | Nhãn tiếng Việt | 1 | 3 | 5 |
|---|---|---|---|---|
| `noise` | Độ ồn | Rất yên | Có tiếng nền | Rất ồn |
| `crowd` | Độ đông | Rất vắng | Vừa phải | Rất đông |
| `lighting` | Độ dịu ánh sáng | Sáng rõ | Cân bằng | Tối và ấm |
| `privacy` | Độ riêng tư | Rất mở | Vừa đủ | Rất riêng tư |
| `workability` | Khả năng làm việc | Không phù hợp | Làm việc ngắn | Rất phù hợp |
| `social_energy` | Nhịp không gian | Trầm lắng | Có sức sống | Rất sôi động |

## 1. Độ ồn — `noise`

**Câu hỏi:** “Lúc bạn ghé, không gian ồn đến mức nào?”

| Điểm | Nhãn | Mô tả quan sát |
|---:|---|---|
| 1 | Rất yên | Có thể đọc hoặc tập trung mà hầu như không bị phân tâm |
| 2 | Khá yên | Có tiếng nền nhẹ, nói chuyện nhỏ vẫn nghe rõ |
| 3 | Vừa phải | Có tiếng nói chuyện/nhạc nhưng vẫn giao tiếp bình thường |
| 4 | Khá ồn | Khó tập trung lâu, đôi lúc phải nói lớn hơn |
| 5 | Rất ồn | Phải nói lớn; không phù hợp công việc cần tập trung |

Không suy ra `noise` chỉ từ âm lượng nhạc; đánh giá tổng thể tại khu vực người dùng ngồi.

## 2. Độ đông — `crowd`

**Câu hỏi:** “Lúc bạn ghé, quán đông đến mức nào?”

| Điểm | Nhãn | Mô tả quan sát |
|---:|---|---|
| 1 | Rất vắng | Nhiều bàn trống, chọn chỗ dễ dàng |
| 2 | Khá vắng | Còn nhiều lựa chọn chỗ ngồi |
| 3 | Vừa phải | Có khách ổn định nhưng vẫn tìm được chỗ |
| 4 | Khá đông | Ít lựa chọn chỗ ngồi hoặc cần chờ ngắn |
| 5 | Rất đông | Gần kín/chật, khó tìm chỗ hoặc phải chờ |

`crowd` mô tả mật độ người; `seat_availability` ghi trực tiếp khả năng tìm chỗ nên hai trường được lưu riêng.

## 3. Độ dịu ánh sáng — `lighting`

**Câu hỏi:** “Ánh sáng ở khu vực bạn ngồi mang cảm giác nào?”

| Điểm | Nhãn | Mô tả quan sát |
|---:|---|---|
| 1 | Rất sáng | Ánh sáng rõ/mạnh, phù hợp đọc và làm việc |
| 2 | Khá sáng | Đủ sáng, không cần điều chỉnh màn hình nhiều |
| 3 | Cân bằng | Không quá sáng hoặc tối |
| 4 | Khá dịu | Ánh sáng thấp/ấm, tạo cảm giác thư giãn |
| 5 | Tối và ấm | Ánh sáng mood rõ, có thể khó đọc/làm việc |

V1 kết hợp độ sáng và cảm giác ấm để giảm số câu hỏi. Nếu dữ liệu cho thấy hai yếu tố này tách biệt, V2 sẽ tách `brightness` và `color_temperature`.

## 4. Độ riêng tư — `privacy`

**Câu hỏi:** “Bạn có cảm thấy đủ riêng tư tại chỗ ngồi không?”

| Điểm | Nhãn | Mô tả quan sát |
|---:|---|---|
| 1 | Rất mở | Bàn sát nhau, người khác dễ nghe cuộc trò chuyện |
| 2 | Khá mở | Khoảng cách hạn chế, ít che chắn |
| 3 | Vừa đủ | Có thể trò chuyện bình thường nhưng không kín đáo |
| 4 | Khá riêng tư | Khoảng cách tốt hoặc có góc tách biệt |
| 5 | Rất riêng tư | Không gian tách biệt, phù hợp trò chuyện cá nhân |

Đây là cảm nhận về bố trí không gian, không phải cam kết bảo mật.

## 5. Khả năng làm việc — `workability`

**Câu hỏi:** “Không gian này phù hợp để làm việc đến mức nào?”

| Điểm | Nhãn | Mô tả quan sát |
|---:|---|---|
| 1 | Không phù hợp | Khó mở laptop hoặc tập trung |
| 2 | Hạn chế | Chỉ xử lý việc nhanh; thiếu một số điều kiện cơ bản |
| 3 | Làm việc ngắn | Phù hợp khoảng 30–60 phút |
| 4 | Khá phù hợp | Có thể làm việc vài giờ tương đối thoải mái |
| 5 | Rất phù hợp | Bàn ghế, không gian và nhịp quán hỗ trợ làm việc lâu |

`workability` là đánh giá tổng hợp. Ổ điện, Wi‑Fi và bàn ghế sẽ là tiện ích/ghi chú riêng khi có dữ liệu đáng tin cậy.

## 6. Nhịp không gian — `social_energy`

**Câu hỏi:** “Không khí lúc bạn ghé trầm hay sôi động?”

| Điểm | Nhãn | Mô tả quan sát |
|---:|---|---|
| 1 | Rất trầm | Mọi người chủ yếu ở một mình hoặc làm việc yên lặng |
| 2 | Khá trầm | Nhịp chậm, ít tương tác nhóm |
| 3 | Có sức sống | Có trò chuyện và chuyển động nhưng không áp đảo |
| 4 | Sôi động | Nhiều nhóm trò chuyện, nhịp nhanh |
| 5 | Rất sôi động | Không khí náo nhiệt là đặc điểm nổi bật |

`social_energy` khác `noise`: một nơi có thể đông nhưng trầm, hoặc ít người nhưng nhạc lớn.

## Context bổ sung

| Field | Giá trị hợp lệ | Ý nghĩa |
|---|---|---|
| `visit_mode` | `work`, `study`, `solo`, `date`, `friends`, `business_meeting`, `relax`, `late_night` | Hoàn cảnh của report |
| `seat_availability` | `easy`, `normal`, `difficult`, `unknown` | Khả năng tìm chỗ |
| `location_verification` | `none`, `recalled`, `approximate`, `verified` | Mức xác minh vị trí |
| `area_hint` | Chuỗi tối đa 80 ký tự | Ví dụ: tầng 2, sân vườn |
| `short_note` | Chuỗi tối đa 140 ký tự | Quan sát hữu ích, không chứa dữ liệu cá nhân |

## Câu hỏi ưu tiên theo mục đích

| Mục đích | Ba câu bắt buộc đề xuất | Câu bổ sung |
|---|---|---|
| Làm việc | `noise`, `crowd`, `workability` | `lighting`, `privacy` |
| Đi một mình | `crowd`, `privacy`, `social_energy` | `noise`, `lighting` |
| Hẹn hò | `noise`, `privacy`, `lighting` | `crowd`, `social_energy` |
| Học/đọc | `noise`, `lighting`, `workability` | `crowd`, `privacy` |
| Gặp bạn | `crowd`, `social_energy`, `noise` | `privacy`, `lighting` |
| Họp việc | `noise`, `privacy`, `workability` | `crowd`, `lighting` |
| Thư giãn | `noise`, `crowd`, `social_energy` | `lighting`, `privacy` |
| Đi khuya | `crowd`, `noise`, `privacy` | `lighting`, `social_energy` |

## Quy tắc hiển thị

- Không hiển thị số thô như “noise = 2.3”; hiển thị “Khá yên”.
- Snapshot phải kèm số report, khung giờ và confidence.
- Khi dưới 3 report, hiển thị “Dữ liệu còn ít”.
- `editorial` và `community` phải được phân biệt trong provenance.
- Fixture có `is_simulated=true` luôn hiển thị banner “Dữ liệu mô phỏng”.

## Điểm cần review

1. Có giữ tên “Độ dịu ánh sáng” hay đổi thành “Ánh sáng”?
2. Có cần `workability` là chiều chính hay chuyển thành score suy ra từ nhiều tiện ích?
3. Có cần `social_energy` đổi nhãn thành “Độ sôi động” để dễ hiểu hơn?
4. Thang 1–5 có đủ nhanh hay contribution UI nên chỉ có 3 lựa chọn?
