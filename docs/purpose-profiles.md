# Purpose profiles v1

Trạng thái: **approved v1 — 2026-08-13**. Phạm vi 8 mục đích và trọng số mặc định đã được chốt; đây vẫn là giả thuyết chưa được validation với người thật.

## Quy ước

- `weight`: 0–5; 0 nghĩa là không dùng trong ranking mặc định.
- `ideal`: khoảng điểm vibe mong muốn.
- Preference người dùng ghi đè profile mặc định.
- Confidence, giờ mở cửa, khoảng cách, giá và tiện ích được xử lý riêng.

## Tám mục đích MVP

| Key | Nhãn | Preset hiển thị |
|---|---|---|
| `work` | Làm việc | Yên · Có bàn/ổ điện · Ngồi lâu |
| `study` | Học/đọc sách | Yên · Sáng · Ít phân tâm |
| `solo` | Đi một mình | Thoải mái · Không quá đông |
| `date` | Hẹn hò | Dễ trò chuyện · Dịu · Riêng tư |
| `friends` | Gặp bạn bè | Bàn nhóm · Có sức sống |
| `business_meeting` | Họp công việc | Ít ồn · Riêng tư · Wi-Fi tốt |
| `relax` | Thư giãn | Thoáng · Nhịp chậm · Dễ chịu |
| `late_night` | Đi khuya | Mở muộn · An toàn · Còn chỗ |

## Trọng số vibe

| Purpose | Noise | Crowd | Lighting | Privacy | Workability | Social energy |
|---|---:|---:|---:|---:|---:|---:|
| `work` | 5 (1–2) | 3 (1–3) | 2 (1–3) | 2 (3–5) | 5 (4–5) | 2 (1–2) |
| `study` | 5 (1–2) | 3 (1–3) | 4 (1–2) | 2 (3–5) | 4 (4–5) | 3 (1–2) |
| `solo` | 2 (1–3) | 4 (1–3) | 1 (2–4) | 4 (3–5) | 1 (2–5) | 3 (1–3) |
| `date` | 4 (2–3) | 2 (2–4) | 3 (4–5) | 5 (4–5) | 0 | 2 (2–4) |
| `friends` | 2 (2–4) | 2 (2–4) | 1 (1–4) | 1 (1–4) | 0 | 5 (3–5) |
| `business_meeting` | 5 (1–2) | 2 (1–3) | 2 (1–3) | 5 (4–5) | 4 (4–5) | 2 (1–2) |
| `relax` | 3 (1–3) | 3 (1–3) | 2 (2–4) | 2 (2–5) | 0 | 4 (1–2) |
| `late_night` | 2 (1–4) | 3 (1–3) | 2 (3–5) | 2 (2–5) | 0 | 2 (1–4) |

Giá trị trong ngoặc là khoảng `ideal`.

## Tiện ích và điều kiện bắt buộc/ưu tiên

| Purpose | Điều kiện hoặc tiện ích ưu tiên |
|---|---|
| `work` | Wi-Fi, ổ điện, bàn laptop, ghế ngồi lâu |
| `study` | Wi-Fi, bàn laptop, ánh sáng đọc, không hút thuốc |
| `solo` | Dễ tìm chỗ, không yêu cầu đặt bàn |
| `date` | Khu riêng tư, đặt bàn là điểm cộng |
| `friends` | Bàn nhóm, sức chứa phù hợp |
| `business_meeting` | Wi-Fi, phòng/khu riêng, bàn nhóm |
| `relax` | Ngoài trời, sân vườn hoặc ghế thoải mái |
| `late_night` | Mở tại thời điểm chọn; chỗ gửi xe là điểm cộng |

`late_night` luôn có hard filter: địa điểm phải mở đủ thời lượng dự kiến.

## Câu hỏi contribution ưu tiên

| Purpose | Ba chiều bắt buộc |
|---|---|
| `work` | `noise`, `crowd`, `workability` |
| `study` | `noise`, `lighting`, `workability` |
| `solo` | `crowd`, `privacy`, `social_energy` |
| `date` | `noise`, `privacy`, `lighting` |
| `friends` | `crowd`, `social_energy`, `noise` |
| `business_meeting` | `noise`, `privacy`, `workability` |
| `relax` | `noise`, `crowd`, `social_energy` |
| `late_night` | `crowd`, `noise`, `privacy` |

## Công thức v1

```text
dimension_match = 1 - normalized_distance_from_ideal_range

base_match =
  sum(dimension_match × weight for available dimensions)
  / sum(weight for available dimensions)

final_score = base_match
  × confidence_multiplier
  × open_for_duration_multiplier
  × distance_multiplier
  × required_amenities_multiplier
  × price_match_multiplier
```

Địa điểm thiếu dimension không nhận điểm 0; dimension bị loại khỏi mẫu số. Nếu thiếu quá 50% tổng trọng số, hiển thị “Dữ liệu chưa đủ”.

## Lý do giải thích kết quả

Mỗi kết quả hiển thị tối đa hai tín hiệu tốt và một cảnh báo:

```text
✓ Khá yên vào sáng ngày thường
✓ Có Wi-Fi và ổ điện
! Dữ liệu còn ít: 2 report
```

Không diễn giải dimension không có dữ liệu và không dùng câu khẳng định tuyệt đối.
