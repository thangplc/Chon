# Kế hoạch tích hợp VIETMAP POI

Trạng thái: **đã triển khai adapter, live sync/import guarded và Explore rollout**.
Việc gọi live và ghi dữ liệu thật vẫn chờ API key, category cafe và terms gate.

## Mục tiêu

Lấy dữ liệu POI quán cà phê thật từ VIETMAP, lưu thành dữ liệu địa điểm
canonical trong PostgreSQL/PostGIS và hiển thị qua Explore map/list của Chốn.

Phạm vi rollout đầu tiên là các `service_areas` đang active:

- Quận 1
- Quận 3
- Bình Thạnh

Đây là phạm vi kiểm chứng ban đầu, không phải giới hạn của adapter. Khi thêm
service area vào database, cùng pipeline có thể đồng bộ khu vực đó bằng cấu
hình.

## Ngoài phạm vi

- Không lấy review hoặc vibe từ VIETMAP.
- Không gọi VIETMAP trực tiếp từ request của web.
- Không tự động tạo hoặc activate service area từ tên quận/tỉnh provider trả về.
- Chưa mở rộng toàn bộ TP.HCM hoặc các loại địa điểm khác trong đợt đầu.
- Rollout hiện tại chỉ dùng category cafe `1001-1`; chưa chạy đồng thời nhiều
  category POI liên quan.
- Chưa xây Admin Dashboard.

## Mở rộng category — deferred

Giai đoạn hiện tại giữ `VIETMAP_POI_CATEGORY_CAFE=1001-1` làm baseline đã biết
để tránh tăng nhiễu trong lúc hoàn thiện sản phẩm. Sau MVP sẽ thực hiện một
coverage spike trước khi mở rộng sang các category liên quan như coffee shop,
trà/cafe, bakery/cafe, nhà hàng, khách sạn và các POI du lịch.

Việc mở rộng không chỉ là thêm mã category. Pipeline cần:

- cấu hình danh sách category theo loại địa điểm, không hard-code một mã;
- đo phần POI mới và phần giao nhau của từng category/query;
- hợp nhất theo provider ID và kiểm tra duplicate tên + tọa độ;
- lưu category provenance để biết POI đến từ lượt discovery nào;
- dry-run/coverage report và review false positive trước khi import thật;
- chỉ bật category mới trên production sau khi qua quota, terms và quality gate.

## Quyết định kiến trúc

- VIETMAP là **POI provider**, tách khỏi `provider/vibe` registry.
- API key chỉ nằm ở `apps/api`; frontend không được biết credential.
- Sync chạy server-side theo batch/operator hoặc scheduler về sau.
- Web chỉ đọc snapshot POI đã lưu trong database.
- Membership khu vực được quyết định bằng PostGIS `ST_Covers`, không dựa vào
  chuỗi `district` do provider trả về.
- Mọi lần sync phải có dry-run, provenance, deduplication và transaction.
- Dữ liệu POI thật dùng `is_simulated=false`; không tạo `vibe_reports` tự động.
- Mặc định record mới là `draft`; chỉ publish sau khi qua review/gate tương ứng.

## Các giai đoạn

### 1. Credential và terms spike

Trạng thái: **đã chuẩn bị tooling, chưa chạy live**.

- Xác nhận API key, endpoint/version, quota, rate limit và timeout.
- Xác nhận category code chính xác cho cafe.
- Lấy response mẫu thật cho cả ba service area.
- Xác nhận quyền lưu `provider_place_id`, địa chỉ, tọa độ, category và raw
  payload; xác định attribution cần hiển thị.

Output: `vietmap` provider spike report, response fixtures đã loại secret và
quyết định storage policy.

### 2. Canonical POI contract

Trạng thái: **đã triển khai** tại `apps/api/src/providers/poi/` với fixture v1.

Chuẩn hóa tối thiểu:

- `provider_place_id`
- `name`
- `address`
- `latitude`, `longitude`
- địa chỉ hành chính cũ/mới nếu provider trả về
- category code và category label
- `retrieved_at`, `source_url`, `provider_product`

Các field không có hoặc không được phép lưu sẽ giữ `NULL`, không suy diễn.
Fixture được đánh dấu `sourceKind=synthetic_fixture` và không thể dùng làm
record production; chỉ transport live mới tạo `sourceKind=live`.

### 3. VIETMAP adapter

Trạng thái: **đã triển khai server-side, fixture-first với live transport**.

Tạo adapter riêng tại `apps/api/src/providers/poi/vietmap/`:

- HTTP client server-side.
- Zod response contract.
- Normalize response về canonical POI input.
- Timeout, retry có giới hạn, xử lý 401/403/429/5xx.
- Không ghi API key vào log.
- Provider registry và feature flag riêng, không dùng vibe registry.

### 4. Spatial discovery

Trạng thái: **đã triển khai** trong `scripts/vietmap-poi-sync.ts`; lần chạy live
đầu tiên vẫn cần credential và category cafe.

- Đọc các boundary `service_areas` đang active từ PostGIS.
- Chia boundary thành các ô/bán kính truy vấn phù hợp.
- Gọi VIETMAP theo category cafe và `layers=POI`.
- Tính membership bằng PostGIS `ST_Covers`; POI ngoài boundary bị ghi warning
  trong import summary để operator review trước khi publish.
- Dedupe theo provider ID; fallback bằng tên + khoảng cách nếu cần.
- Tạo coverage report: số request, số kết quả, số unique, số ngoài boundary,
  số lỗi và số bị rate-limit.

Không giả định một request trả về toàn bộ POI của một quận.

### 5. Import và persistence

Trạng thái: **đã triển khai** qua importer guarded; `--dry-run` vẫn là mặc định
an toàn cho lần kiểm tra đầu.

- Tái sử dụng safety guard của data pipeline.
- Tạo plan create/update/unchanged/conflict.
- Ghi `places` với `is_simulated=false`.
- Ghi `place_sources` với provider ID, sync timestamp, source URL và raw data
  chỉ khi terms cho phép.
- Tính lại `place_service_areas` bằng geometry hiện hành.
- Idempotent theo `(provider, provider_place_id)`.
- `--dry-run` tuyệt đối không ghi database.

### 6. Web và API verification

- API spatial query trả POI VIETMAP đã publish.
- Explore map/list hiển thị các địa điểm mới mà không cần gọi VIETMAP từ browser.
- Địa điểm chưa có vibe hiển thị trạng thái thiếu dữ liệu, không bị gán vibe
  giả.
- Provider outage không làm mất các POI snapshot đã lưu.

### 7. Rollout

1. Local: dry-run và import ba khu vực.
2. Staging: kiểm tra coverage, duplicate, attribution và UX.
3. Production: chỉ bật sau credential, terms, quota, storage và review gate.
4. Mở rộng thêm khu vực bằng `service_areas`, không sửa adapter.

## Cấu hình dự kiến

```ini
VIETMAP_API_KEY=
VIETMAP_POI_ENABLED=false
VIETMAP_POI_CATEGORY_CAFE=1001-1
VIETMAP_POI_PLACE_BASE_URL=https://maps.vietmap.vn/api/place/v4
VIETMAP_POI_REVERSE_BASE_URL=https://maps.vietmap.vn/api/reverse/v4
VIETMAP_POI_TIMEOUT_MS=5000
VIETMAP_POI_REQUEST_INTERVAL_MS=500
VIETMAP_POI_MAX_REQUESTS=200
```

## Command dự kiến

```bash
VIETMAP_POI_MAX_REQUESTS=500 pnpm vietmap:poi:sync \
  --areas q1,q3,binh-thanh --category 1001-1 --dry-run
VIETMAP_POI_MAX_REQUESTS=500 pnpm vietmap:poi:sync \
  --areas q1,q3,binh-thanh --category 1001-1 --environment local
pnpm service-areas:verify
```

Sync live dùng service key ở backend, chuyển response thành normalized POI CSV
tạm thời rồi chạy importer guarded. Search v4 trả `ref_id`; sync gọi Place v4
khi thiếu tọa độ, sau đó gọi Reverse v4 khi địa chỉ chưa đủ cụ thể để lấy thêm
số nhà/đường/hẻm/phường/quận/thành phố theo chính tọa độ POI trước khi import.
Địa chỉ sau chuẩn hóa được lưu vào
`places.address`; district được xác định theo boundary thực tế của tọa độ,
không theo tâm search. `place_sources` lưu provider `vietmap_maps`
và `ref_id`; không lưu API key hay gọi VIETMAP từ browser. Explore chỉ đọc POI
thật khi `EXPLORE_PLACE_DATA_MODE=real` ở API và dữ liệu đã được import.
Sau import, dùng `service-areas:verify` để kiểm tra boundary và
`place_service_areas` hiện hành.
Sync production còn bị chặn nếu chưa bật `VIETMAP_POI_PRODUCTION_READY=true`.

## Admin Dashboard — deferred

Admin Dashboard không thuộc MVP hiện tại. Trong giai đoạn này, founder/developer
vẫn dùng GeoJSON + operator script để thêm và activate service area.

Sau MVP, Dashboard sẽ hỗ trợ upload/preview/validate boundary, lưu source và
version, activate/rollback service area, chạy POI sync và xem audit/coverage.

## Acceptance criteria

- Có POI cafe thật trong cả ba khu vực mục tiêu.
- Không có POI ngoài boundary hoặc duplicate provider ID.
- Mỗi POI có provenance và `retrieved_at`.
- Dry-run, conflict report và production guard hoạt động.
- Explore map/list hiển thị dữ liệu đã import.
- Không có vibe/review nào được suy diễn từ VIETMAP.

## Tài liệu provider tham chiếu

- [VIETMAP Geocode v4](https://maps.vietmap.vn/docs/map-api/geocode-version/geocode-v4/)
- [VIETMAP Autocomplete v4](https://maps.vietmap.vn/docs/map-api/autocomplete-version/autocomplete-v4/)
- [VIETMAP Place v4](https://maps.vietmap.vn/docs/map-api/place-v4/)
