# Data contract v1.1

Trạng thái: **approved v1.1 — 2026-08-13**.

Chính sách chọn nguồn và hiển thị vibe: [Vibe data policy](vibe-data-policy.md).

## 1. Phạm vi

Contract này quy định CSV phục vụ fixtures, research và production seed. Importer được triển khai ở Sprint 1.

Encoding và định dạng chung:

- UTF-8, có header, dấu phân cách `,`.
- Timestamp dùng ISO 8601 kèm timezone, ví dụ `2026-08-13T09:30:00+07:00`.
- Boolean chỉ nhận `true` hoặc `false` viết thường.
- Giá trị thiếu để trống; không dùng `N/A`, `null` hoặc `-` trong CSV.
- ID là ASCII snake case, không thay đổi sau khi record được tạo.
- Field chứa dấu phẩy, xuống dòng hoặc dấu nháy phải được CSV-quote đúng chuẩn.

## 2. Enum dùng chung

```text
data_type:
  synthetic | research | editorial | community

place_status:
  draft | published | archived

moderation_status:
  pending | approved | flagged | rejected | archived

visit_mode:
  work | study | solo | date | friends | business_meeting | relax | late_night

seat_availability:
  easy | normal | difficult | unknown

location_verification:
  none | recalled | approximate | verified

day_type:
  weekday | friday | weekend

time_bucket:
  morning | midday | afternoon | evening | late
```

## 2.1. Hai trục nguồn dữ liệu

Chốn quản lý nguồn dữ liệu theo hai trục độc lập:

1. `provider provenance`: dữ liệu POI và tín hiệu vibe lấy từ bên thứ ba.
2. `data_type`: report vibe/nghiệp vụ được tạo trong quá trình phát triển, nghiên cứu hoặc sử dụng Chốn.

| Trục | Giá trị | Ví dụ dữ liệu |
|---|---|---|
| Provider provenance | Provider adapter cụ thể | POI nền hoặc tín hiệu rating/review summary/tips/popular hours/amenities |
| `data_type` | `synthetic`, `research`, `editorial`, `community` | Vibe report và dữ liệu nghiệp vụ do Chốn tạo/thu trực tiếp |

`provider` không phải data type thứ năm. Một địa điểm có ID nội bộ duy nhất nhưng có thể mapping tới nhiều provider trong `place-sources.csv`. Tín hiệu bên thứ ba không được giả thành `editorial` hoặc `community`.

## 3. `places.csv`

| Field | Bắt buộc | Kiểu | Validation |
|---|---:|---|---|
| `internal_id` | Có | string | Unique; `^[a-z0-9_]{3,64}$` |
| `name` | Có | string | 1–120 ký tự |
| `address` | Có | string | 1–240 ký tự |
| `latitude` | Có | decimal | -90 đến 90 |
| `longitude` | Có | decimal | -180 đến 180 |
| `district` | Có | string | V1: Quận 1, Quận 3, Bình Thạnh |
| `status` | Có | enum | `draft`, `published`, `archived` |
| `is_simulated` | Có | boolean | Production bắt buộc `false` |
| `size_category` | Không | enum | `small`, `medium`, `large`, `unknown` |
| `estimated_capacity` | Không | integer | Lớn hơn 0; chỉ nhập khi có nguồn |
| `price_level` | Không | integer | 1–4 |
| `typical_spend_min` | Không | integer | VND; không âm |
| `typical_spend_max` | Không | integer | VND; không nhỏ hơn min |
| `currency` | Có | string | V1 mặc định `VND` |
| `opening_hours` | Không | JSON string | Contract lịch thường lệ v1; xem quy tắc bên dưới |

Quy tắc:

- `internal_id` là ID của Chốn, không dùng ID provider làm khóa chính.
- Fixture ID bắt đầu bằng `syn_`.
- Production place không được có tên/địa chỉ chứa “hư cấu”, “fixture” hoặc prefix fixture đã biết.
- Tọa độ trùng hoặc tên gần giống trong bán kính nhỏ phải được báo là conflict, không tự merge.

### `opening_hours` v1

`opening_hours` mô tả lịch thường lệ, không khẳng định quán đang mở hay đóng tại
thời điểm người dùng xem. Giá trị CSV là một JSON object có cấu trúc:

```json
{
  "timezone": "Asia/Ho_Chi_Minh",
  "weekly": {
    "monday": [{ "opens": "07:00", "closes": "22:00" }],
    "tuesday": [{ "opens": "07:00", "closes": "22:00" }],
    "wednesday": [{ "opens": "07:00", "closes": "22:00" }],
    "thursday": [{ "opens": "07:00", "closes": "22:00" }],
    "friday": [{ "opens": "07:00", "closes": "22:00" }],
    "saturday": [{ "opens": "08:00", "closes": "23:00" }],
    "sunday": []
  }
}
```

Quy tắc v1:

- `timezone` bắt buộc là `Asia/Ho_Chi_Minh`; `weekly` phải có đúng bảy ngày.
- Mỗi ngày có 0–4 khoảng, dùng định dạng 24 giờ `HH:mm`; mảng rỗng nghĩa là đóng cửa theo lịch thường lệ.
- Khoảng giờ phải nằm trong cùng ngày, được sắp tăng dần và không chồng lấn. Lịch qua nửa đêm được hoãn sang contract sau.
- Field rỗng nghĩa là chưa có lịch đã xác minh; importer không suy diễn từ dữ liệu khác.

## 4. `place-sources.csv`

| Field | Bắt buộc | Kiểu | Validation |
|---|---:|---|---|
| `place_id` | Có | string | Tồn tại trong `places.csv`/database |
| `provider` | Có | string | Provider adapter đã được cấu hình |
| `provider_place_id` | Có | string | Không rỗng |
| `last_synced_at` | Có | timestamp | ISO 8601 |
| `source_url` | Không | URL | Chỉ lưu khi terms cho phép |

Unique key: `provider + provider_place_id`.

Provider adapter được cấu hình trong MVP:

```text
fsq_os_places
openstreetmap
```

`openstreetmap` dùng cho provenance POI và metadata được enrich từ OSM, như
`opening_hours`. Đây không phải `data_type` thứ năm. OSM object ID, thời điểm
đọc, URL attribution và raw tags tối thiểu được lưu trong `place_sources`; dữ
liệu canonical chỉ được cập nhật khi match tên + khoảng cách đạt ngưỡng và
field hiện tại còn trống.

Provider vibe candidates đã được chốt nhưng chỉ kích hoạt sau integration gate:

```text
foursquare_places
google_places
yelp
tripadvisor
```

Database đồng thời giữ unique key `place_id + provider` để ngăn một canonical place bị gán âm thầm sang hai ID của cùng provider.

### Quy tắc đồng bộ provider

- Adapter chỉ lấy các field được điều khoản provider cho phép sử dụng và lưu trữ.
- Mỗi lần sync cập nhật `last_synced_at` và provenance; không thay ID nội bộ của Chốn.
- Không âm thầm ghi đè chỉnh sửa đã được Chốn xác minh. Xung đột phải được báo trong dry-run/import summary.
- Dữ liệu có khả năng thay đổi như giờ mở cửa cần TTL/sync cadence riêng.
- Ảnh, review và dữ liệu atmosphere tuân theo policy riêng; không mặc định được cache chỉ vì POI metadata được phép lưu.
- Khi một địa điểm xuất hiện từ nhiều provider, importer tạo mapping bổ sung hoặc conflict để review, không tạo bản sao tự động.

### Thứ tự ưu tiên canonical field trong MVP

```text
editorial đã xác minh
  > provider mới và hợp lệ
  > provider cũ
  > community suggestion chưa xác minh
```

Community chỉ đề xuất sửa POI; không ghi đè canonical place trực tiếp.

## 4.1. `provider-vibe-signals` sync contract

Đây là contract cho API/dataset sync, không phải CSV đóng góp của người dùng.

| Field | Bắt buộc | Kiểu | Validation |
|---|---:|---|---|
| `place_id` | Có | string | Canonical place tồn tại |
| `place_source_id` | Có | string | Mapping provider của đúng place |
| `provider_product` | Có | string | Gói/API đã được allowlist |
| `provider_signal_id` | Có | string | ID ổn định hoặc hash idempotency |
| `signal_type` | Có | enum | Allowlist theo adapter |
| `signal_value` | Có điều kiện | JSON | Bắt buộc với `ttl_cache`/`persist_allowed`; null với `reference_only` |
| `noise`, `crowd`, `lighting`, `privacy`, `workability`, `social_energy` | Không | decimal | Mỗi chiều 1–5; chỉ điền chiều có evidence |
| `mapping_version` | Có điều kiện | string | Bắt buộc khi có `dimension_scores` |
| `day_type` | Không | enum | Không suy diễn nếu provider không có context thời gian |
| `time_bucket` | Không | enum | Không suy diễn nếu provider không có context thời gian |
| `confidence_score` | Có | decimal | 0–1; confidence của tín hiệu, không phải mức độ “tốt” |
| `retrieved_at` | Có | timestamp | ISO 8601 |
| `observed_at` | Không | timestamp | Thời điểm tín hiệu mô tả, nếu provider cung cấp |
| `expires_at` | Không | timestamp | Bắt buộc với dữ liệu có TTL/cache restriction |
| `source_url` | Không | URL | Theo attribution policy |
| `attribution_text` | Không | string | Bắt buộc nếu provider yêu cầu |
| `storage_policy` | Có | enum | `reference_only`, `ttl_cache`, `persist_allowed` |

Quy tắc:

- Không lưu review text, summary, ảnh hoặc raw payload khi terms không cho phép.
- `reference_only` chỉ lưu ID/provenance cần thiết để gọi hoặc link tới nguồn; không persist `signal_value` hay sáu dimension score.
- Tín hiệu không có thời gian chỉ được ánh xạ thành estimate tổng quát, không tạo report giả cho từng time bucket.
- Mapping sang sáu chiều phải versioned, explainable và giữ evidence/provider provenance.
- Xung đột giữa provider hoặc với report Chốn làm giảm confidence; không tự ghi đè nguồn khác.
- UI phải phân biệt “Đóng góp trên Chốn” và “Tín hiệu từ đối tác”.

## 5. `place-areas.csv`

| Field | Bắt buộc | Kiểu | Validation |
|---|---:|---|---|
| `area_id` | Có | string | Unique |
| `place_id` | Có | string | Foreign key hợp lệ |
| `name` | Có | string | 1–80 ký tự |
| `description` | Không | string | Tối đa 240 ký tự |
| `is_simulated` | Có | boolean | Production bắt buộc `false` |

## 6. `place-amenities.csv`

| Field | Bắt buộc | Kiểu | Validation |
|---|---:|---|---|
| `place_id` | Có | string | Place tồn tại |
| `amenity_key` | Có | enum | Danh sách bên dưới |
| `availability` | Có | enum | `yes`, `no`, `unknown` |
| `source_type` | Có | enum | `provider`, `editorial`, `community` |
| `verified_at` | Không | timestamp | Bắt buộc khi editorial |

Amenity keys V1:

```text
wifi | power_outlets | air_conditioning | laptop_table |
long_sitting_chair | toilet | motorbike_parking | car_parking |
outdoor_seating | private_room | pet_friendly | non_smoking |
wheelchair_accessible
```

Unique key: `place_id + amenity_key`. `unknown` khác `no`.

## 7. `place-media.csv`

| Field | Bắt buộc | Kiểu | Validation |
|---|---:|---|---|
| `media_id` | Có | string | Unique |
| `place_id` | Có | string | Place tồn tại |
| `place_area_id` | Không | string | Area thuộc cùng place |
| `media_type` | Có | enum | V1 chỉ `image` |
| `storage_key` | Có điều kiện | string | Dùng cho media do Chốn lưu |
| `source_url` | Có điều kiện | URL | Chỉ khi provider cho phép hotlink/cache |
| `thumbnail_key` | Không | string | Thumbnail do Chốn tạo |
| `width` | Có | integer | Lớn hơn 0 |
| `height` | Có | integer | Lớn hơn 0 |
| `source_type` | Có | enum | `provider`, `editorial`, `community`, `synthetic` |
| `source_reference` | Không | string | Provider ID hoặc audit reference |
| `rights_status` | Có | enum | `verified`, `provider_allowed`, `pending`, `rejected` |
| `captured_at` | Không | timestamp | Khi biết thời điểm chụp |
| `uploaded_by` | Không | string | User/operator ID nội bộ |
| `alt_text` | Có | string | 1–240 ký tự |
| `sort_order` | Có | integer | 0–4 trong gallery MVP |
| `moderation_status` | Có | enum | Enum dùng chung |
| `is_simulated` | Có | boolean | Production bắt buộc `false` |

Quy tắc gallery MVP:

- Tối đa 5 ảnh active cho một địa điểm; `sort_order=0` là cover.
- Ảnh production phải có `rights_status` hợp lệ và moderation approved.
- Không lấy ảnh từ Google Maps/mạng xã hội nếu chưa có quyền.
- Ảnh community cần moderation; ảnh provider tuân theo terms về cache, attribution và thời hạn.
- Placeholder/synthetic image không được xuất hiện production như ảnh thật.

## 8. Core vibe report fields

Mọi report có các field cốt lõi:

| Field | Bắt buộc | Kiểu | Validation |
|---|---:|---|---|
| `report_id` | Có | string | Unique; immutable |
| `place_id` | Có | string | Place tồn tại và không archived tại thời điểm import mới |
| `visited_at` | Có | timestamp | Không ở tương lai; timezone bắt buộc |
| `visit_mode` | Có | enum | Theo danh sách dùng chung |
| `noise` | Không | integer | 1–5 hoặc trống |
| `crowd` | Không | integer | 1–5 hoặc trống |
| `lighting` | Không | integer | 1–5 hoặc trống |
| `privacy` | Không | integer | 1–5 hoặc trống |
| `workability` | Không | integer | 1–5 hoặc trống |
| `social_energy` | Không | integer | 1–5 hoặc trống |
| `seat_availability` | Không | enum | Mặc định `unknown` |
| `location_verification` | Có | enum | Theo nguồn report |
| `data_type` | Có | enum | Một trong bốn loại đã chốt |
| `is_simulated` | Có | boolean | Production bắt buộc `false` |
| `moderation_status` | Có | enum | Import mặc định `pending`, trừ editorial đã review |

Ít nhất ba trong sáu vibe dimensions phải có giá trị.

## 9. Type-specific report fields

### `synthetic-vibe-reports.csv`

Thêm:

| Field | Bắt buộc | Quy tắc |
|---|---:|---|
| `day_type` | Có | Enum dùng chung |
| `time_bucket` | Có | Enum dùng chung |
| `short_note` | Không | Tối đa 140 ký tự; không chứa dữ liệu cá nhân |

Bắt buộc: `data_type=synthetic`, `is_simulated=true`, `location_verification=none`.

### `research-vibe-reports.csv`

Thêm:

| Field | Bắt buộc | Quy tắc |
|---|---:|---|
| `participant_id` | Có | Pseudonymous ID, không dùng email/số điện thoại |
| `consent_recorded` | Có | Boolean |
| `source_note` | Không | Tối đa 240 ký tự |

Bắt buộc: `data_type=research`. Dữ liệu thật yêu cầu `is_simulated=false` và `consent_recorded=true`.

### `editorial-vibe-reports.csv`

Thêm:

| Field | Bắt buộc | Quy tắc |
|---|---:|---|
| `verified_by` | Có | Operator/curator ID |
| `verified_at` | Có | Không trước `visited_at` |
| `source_note` | Có | Mô tả cách xác minh |

Bắt buộc: `data_type=editorial`, `is_simulated=false` ở production, `location_verification=verified` và `moderation_status=approved`.

### `community-vibe-reports.csv`

Thêm:

| Field | Bắt buộc | Quy tắc |
|---|---:|---|
| `user_id` | Có | User ID nội bộ |
| `short_note` | Không | Tối đa 140 ký tự |

Community report production đi qua API; CSV chỉ dùng cho migration/operations có kiểm soát. Import mới mặc định `moderation_status=pending`.

## 10. Data-type và môi trường

| Data type | Local/CI | Staging | Research workspace | Production |
|---|---:|---:|---:|---:|
| `synthetic` | Có | Có | Không cần | Không |
| `research` | Không cần | Chỉ bản đã ẩn danh | Có | Không |
| `editorial` | Fixture hoặc bản thật kiểm soát | Có thể | Có thể | Có |
| `community` | Fixture mô phỏng | Không dùng dữ liệu user thật | Không cần | Có |

Production importer từ chối toàn bộ transaction nếu:

```text
data_type IN (synthetic, research)
OR is_simulated = true
OR internal_id/report_id starts with a fixture prefix
```

Không được tự động đổi `data_type` hoặc `is_simulated` trong importer.

## 11. Quy tắc chuyển `research`

Research không được import thẳng production. Chuyển đổi là thao tác riêng:

1. Kiểm tra consent cho mục đích production.
2. Xác minh place, thời gian ghé và provenance.
3. Chọn đích:
   - `community` nếu report thuộc một user Chốn có thể truy vết consent.
   - `editorial` nếu nhóm Chốn chịu trách nhiệm xác minh và xuất bản.
4. Tạo `report_id` production mới.
5. Ghi audit event liên kết research source và production record.

Không sửa trực tiếp nhãn trong file research gốc.

## 12. Versioning

- Contract hiện tại: `1.0`.
- Thêm field tùy chọn tương thích: bump minor.
- Đổi nghĩa, enum hoặc field bắt buộc: bump major và có migration plan.
- Mỗi import manifest ghi `contract_version`, checksum, environment, operator và thời gian chạy.
