# Dữ liệu Chốn

Thư mục này chứa dữ liệu phục vụ phát triển và các template thu thập dữ liệu thật.

## Dataset hiện có

```text
data/
  fixtures/
    places.csv
    place-media.csv
    synthetic-vibe-reports.csv
    simulated-research-vibe-reports.csv
    simulated-editorial-vibe-reports.csv
    simulated-community-vibe-reports.csv
  templates/
    research-vibe-reports.csv
    editorial-vibe-reports.csv
    community-vibe-reports.csv
```

Toàn bộ địa điểm, media và report trong `fixtures/` là hư cấu. Chúng chỉ dùng cho local, CI, staging và prototype. Metadata media nằm trong `place-media.csv`; năm SVG minh họa nằm tại `public/place-media/synthetic/` và không được trình bày như ảnh quán thật.

Explore local dùng pipeline:

```text
CSV giả lập → validation/importer → PostgreSQL → server repository → UI
```

UI không import CSV và không chứa constant địa điểm/media/vibe. Việc lưu fixture vào DB chỉ nhằm test luồng dữ liệu thật của ứng dụng; không làm cho dữ liệu giả lập trở thành dữ liệu production.

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

## Quy tắc an toàn

- Không xem fixture là bằng chứng validation.
- Không đổi `is_simulated` từ `true` thành `false` để đưa dữ liệu lên production.
- Không dùng tên, ghi chú hoặc tọa độ fixture như thông tin thật về một địa điểm.
- Dữ liệu thật phải được nhập lại bằng template phù hợp, có provenance, consent và xác minh theo policy.
