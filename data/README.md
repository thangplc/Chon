# Dữ liệu Chốn

Thư mục này chứa dữ liệu phục vụ phát triển và các template thu thập dữ liệu thật.

## Dataset hiện có

```text
data/
  fixtures/
    places.csv
    editorial-collections.csv
    place-metadata-overlays-real-demo.csv
    place-areas.csv
    place-media.csv
    synthetic-vibe-reports.csv
    simulated-research-vibe-reports.csv
    simulated-editorial-vibe-reports.csv
    simulated-community-vibe-reports.csv
  templates/
    research-vibe-reports.csv
    editorial-vibe-reports.csv
    community-vibe-reports.csv
    place-metadata-overlays.csv
    editorial-collections.csv
```

Các fixture địa điểm, khu vực trong quán, media và report mô phỏng là hư cấu.
Riêng `editorial-collections.csv` chỉ tham chiếu `internal_id` của POI VIETMAP
thật đã import, không biến metadata hoặc vibe mô phỏng thành dữ liệu thật. File
này tạo collection editorial đầu tiên trong môi trường local.

Explore local dùng pipeline:

```text
CSV giả lập → validation/importer → PostgreSQL → server repository → UI
```

UI không import CSV và không chứa constant địa điểm/media/vibe. Việc lưu fixture vào DB chỉ nhằm test luồng dữ liệu thật của ứng dụng; không làm cho dữ liệu giả lập trở thành dữ liệu production.

Metadata demo cho POI thật dùng file `place-metadata-overlays.csv` và bảng
`place_metadata_overlays`. Đây là overlay tách biệt; không sửa các cột
canonical trong `places`. Chỉ nhập các `internal_id` của POI thật đã published
và luôn hiển thị nhãn chưa xác minh trên web.

Các fixture mô phỏng `research`, `editorial`, `community` giữ đúng giá trị `data_type` để test workflow, nhưng luôn có:

```text
is_simulated=true
```

Production importer phải từ chối mọi record có `is_simulated=true`, bất kể `data_type`. Các file trong `templates/` chỉ có header và được dùng để thu thập dữ liệu thật sau này.

`source-objects/` là local mirror bị Git ignore của các source object bất biến như GeoJSON boundary. Đường dẫn sau thư mục này phải trùng `source_storage_key` lưu trong Postgres. Durable copy cho production nằm trong S3-compatible object storage, không nằm trong repository.

Kiểm tra toàn bộ fixture mà không ghi database:

```bash
pnpm data:import seed --dir data/fixtures --environment local --dry-run
pnpm data:import seed --dir data/fixtures --environment local
```

Kiểm tra rồi import collection editorial (idempotent):

```bash
pnpm editorial:collections:import --file data/fixtures/editorial-collections.csv --environment local --dry-run
pnpm editorial:collections:import --file data/fixtures/editorial-collections.csv --environment local
```

Importer chỉ nhận POI `published`, `is_simulated=false`; đồng bộ thứ tự và ghi
chú theo CSV. Ghi production yêu cầu thêm `DATA_IMPORT_ALLOW_PRODUCTION=true`.

## Quy tắc an toàn

- Không xem fixture là bằng chứng validation.
- Không đổi `is_simulated` từ `true` thành `false` để đưa dữ liệu lên production.
- Không dùng tên, ghi chú hoặc tọa độ fixture như thông tin thật về một địa điểm.
- Dữ liệu thật phải được nhập lại bằng template phù hợp, có provenance, consent và xác minh theo policy.
