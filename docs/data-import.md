# Data importer runbook

## Phạm vi

CLI hiện hỗ trợ ba luồng:

- `boundary`: validate/import GeoJSON ranh giới có version vào PostGIS.
- `poi`: validate/import cặp `places.csv` và `place-sources.csv` đã normalize.
- `seed`: validate/import một thư mục gồm `places.csv`, `place-areas.csv` tùy chọn và các file `*-vibe-reports.csv`.

Production import **fail-closed theo record**: chỉ nhận dữ liệu thật và chỉ nhận vibe report `editorial` hoặc `community`. `synthetic`, `research` và mọi record `is_simulated=true` bị từ chối trước khi query dữ liệu hiện có hoặc thực hiện database write.

Mọi import có ghi database còn phải có `DATA_IMPORT_TARGET_ENVIRONMENT` trong `.env` và giá trị này phải khớp `--environment`. Điều này ngăn việc kết nối production nhưng vô tình hoặc cố ý gắn nhãn import là `local`. Dry-run không ghi dữ liệu nên được phép dùng `--environment production` trên target local để kiểm tra policy.

| Environment | Data type được phép | Simulated record |
|---|---|---|
| `local`, `ci`, `staging`, `research` | Cả bốn data type | Cho phép |
| `production` | `editorial`, `community` | Từ chối |

Boundary production không có `data_type`/`is_simulated` nên được kiểm soát bởi validation và provenance contract. POI production được phép khi `places.csv` có `is_simulated=false`.

## Dry-run

Luôn chạy dry-run và review summary trước khi ghi database:

```bash
pnpm data:import poi \
  --file path/to/places.csv \
  --sources path/to/place-sources.csv \
  --dry-run
pnpm data:import seed --dir data/fixtures --dry-run
```

Thêm `--json` để lấy summary máy đọc được:

```bash
pnpm data:import seed --dir data/fixtures --dry-run --json
```

Summary chứa import ID, contract version, checksum từng file, environment, operator, create/update/unchanged/conflict/reject, warning và phân bố `data_type`. Dry-run có `Database writes: 0`.

Có thể kiểm tra production policy an toàn bằng dry-run trước khi import thật:

```bash
pnpm data:import seed --dir path/to/production-seed \
  --environment production --dry-run
```

## Import thật

Sau khi summary không có conflict/reject:

Cấu hình `DATA_IMPORT_TARGET_ENVIRONMENT=local` (hoặc target tương ứng) trong `.env`, sau đó chạy:

```bash
pnpm data:import poi \
  --file path/to/places.csv \
  --sources path/to/place-sources.csv
pnpm data:import seed --dir path/to/seed-directory
```

Import thật chạy trong transaction `SERIALIZABLE` và dùng advisory lock để ngăn hai data import chạy đồng thời. Một lỗi sẽ rollback toàn bộ batch. Stable CSV IDs được map qua `internal_id`, vì vậy chạy lại cùng artifact trả về `unchanged` thay vì tạo duplicate. Cùng ID nhưng nội dung khác được báo conflict và không tự ghi đè.

### Fixture cho Explore local

Pipeline runtime của Explore là:

```text
data/fixtures/*.csv → seed importer → PostgreSQL → Explore repository → Server Component → UI
```

CSV fixture là dữ liệu giả lập, kể cả các report mang `data_type=community`. Chúng luôn giữ `is_simulated=true`, chỉ được Explore repository đọc khi `DATA_IMPORT_TARGET_ENVIRONMENT` là `local`, `ci` hoặc `staging`, và bị production importer từ chối.

Địa điểm được gán vào active service area bằng `ST_Covers` trên current boundary. Chuỗi `district` chỉ là metadata, không quyết định membership. Nếu chưa có boundary, importer vẫn cho phép nạp POI nhưng báo warning `outside_active_service_area`.

## Provider provenance

Provider POI đang được cấu hình trong MVP:

```text
fsq_os_places
```

Mỗi POI trong `places.csv` bắt buộc có ít nhất một record tương ứng trong `place-sources.csv`:

```text
place_id,provider,provider_place_id,last_synced_at,source_url
```

Quy tắc mapping:

- UUID/`internal_id` của Chốn vẫn là định danh nghiệp vụ; provider ID không được dùng làm khóa chính.
- `(provider, provider_place_id)` chỉ được thuộc một place của Chốn.
- Một place chỉ có một mapping hiện hành cho mỗi provider.
- Snapshot mới hơn được phép cập nhật `last_synced_at` và `source_url`.
- Snapshot cũ hơn chỉ tạo warning và không làm lùi provenance đang lưu.
- Provider ID đổi hoặc bị gán sang place khác tạo conflict; importer không tự remap/merge.
- `raw_data` chỉ được lưu bởi adapter khi provider terms cho phép; CSV importer hiện để field này `NULL`.

## Boundary

Ví dụ:

```bash
pnpm data:import boundary \
  --file path/to/hcm-q1.geojson \
  --code hcm-q1 \
  --name "Quận 1" \
  --version 1 \
  --current \
  --source-storage-key boundaries/osm/hcm-q1/v1.geojson \
  --source-name OpenStreetMap \
  --source-relation-id 2778323 \
  --source-url https://www.openstreetmap.org/relation/2778323 \
  --source-license ODbL-1.0 \
  --retrieved-at 2026-08-13T09:00:00+07:00 \
  --dry-run
```

Boundary importer:

- nhận Polygon, MultiPolygon, Feature hoặc FeatureCollection và chuẩn hóa thành `MultiPolygon`;
- kiểm tra geometry không rỗng, hợp lệ và tọa độ trong phạm vi EPSG:4326;
- tính SHA-256 của file nguồn;
- không ghi đè geometry/source metadata của một version đã tồn tại;
- khi `--current`, tắt current version cũ và tính lại `place_service_areas`;
- có thể kích hoạt lại version cũ nếu checksum và source metadata khớp.

GeoJSON nguồn phải được upload vào object storage riêng; `--source-storage-key` chỉ lưu key bất biến trong database.

## Exit code và an toàn

- `0`: validation/import pass; warning không làm command fail.
- `1`: schema error, environment-policy rejection, missing foreign key, duplicate/conflict hoặc DB error.
- Mọi import thật phải có `DATA_IMPORT_TARGET_ENVIRONMENT` khớp `--environment`; không override target inline trong command history.
- CLI không tự merge địa điểm gần giống và không tự sửa `data_type`/`is_simulated`.
- Free-text từ CSV không được in vào summary ngoài validation message tối thiểu.

## Verification

```bash
pnpm data:verify
```

Integration verification chạy boundary → POI/provider mapping → place area → vibe report; kiểm tra spatial membership, provenance update, ownership conflict và idempotence, sau đó rollback toàn bộ dữ liệu test.
