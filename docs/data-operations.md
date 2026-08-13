# Data operations v1

## Vai trò MVP

Trong giai đoạn một người phát triển, cùng một người có thể giữ nhiều vai trò nhưng vẫn phải đi qua checklist và dry-run.

| Vai trò | Người chịu trách nhiệm ban đầu | Trách nhiệm |
|---|---|---|
| Product/Data owner | Founder | Chốt taxonomy, nguồn và mục đích sử dụng |
| Fixture author | Developer | Tạo synthetic/simulated fixtures |
| Seed preparer | Founder hoặc curator được chỉ định | Chuẩn bị CSV seed thật |
| Seed reviewer | Founder | Kiểm tra nội dung và provenance |
| Schema reviewer | Validation script | Kiểm tra kiểu, enum, khóa và guard |
| Import operator | Developer/operator | Dry-run và chạy import |
| Audit owner | Founder/developer | Review import summary và xử lý lỗi |

Phân công đã chốt cho MVP ngày 2026-08-13:

```text
Founder/developer giữ đồng thời vai trò:
- seed preparer
- seed reviewer
- import operator
- audit owner
```

Do chưa có separation of duties, automated validation, `--dry-run`, diff review và import summary là bắt buộc.

## Ba pipeline dữ liệu

### POI bên thứ ba

```text
Provider API/dataset
  → provider adapter
  → terms/field allowlist
  → normalize và deduplicate
  → map vào places + place_sources
  → conflict report
  → database Chốn
```

Developer chịu trách nhiệm adapter/sync job. Founder/developer review provider terms, field allowlist và conflict summary trước production import.

### Tín hiệu vibe bên thứ ba

```text
Foursquare Places Pro/Premium | Google Places | Yelp | Tripadvisor
  → place matching qua place_sources
  → terms/storage/attribution allowlist theo provider
  → normalize signal
  → optional mapping sang sáu chiều có version + confidence
  → provider_vibe_signals
  → fusion layer giữ provenance
```

- Không scrape và không copy dữ liệu provider vào `vibe_reports`.
- `reference_only` được đọc/hiển thị theo policy nhưng không persist content; `ttl_cache` phải có `expires_at`; `persist_allowed` mới được lưu lâu dài.
- Sync của từng provider độc lập. Một provider lỗi, hết quota hoặc bị tắt không được chặn contribution flow của Chốn.
- Trước khi bật production phải có credential smoke test, mẫu coverage tại TP.HCM, chi phí dự kiến và review attribution/terms.

### Dữ liệu do Chốn thu thập

```text
Synthetic/research/editorial/community
  → validation theo data_type
  → environment guard
  → moderation/xác minh phù hợp
  → vibe reports, amenities hoặc media
```

Ba pipeline chỉ gặp nhau qua `places.id` nội bộ và provenance; không dùng external provider ID làm foreign key nghiệp vụ.

Nếu founder và developer là cùng một người, việc review tối thiểu gồm:

1. Tạo pull request hoặc diff riêng cho dataset.
2. Chạy validation.
3. Chạy `--dry-run` và lưu summary.
4. Nghỉ một vòng review hoặc review lại bằng checklist trước production import.

## Quy trình fixture

```text
Developer tạo fixture
  → schema validation
  → automated environment guard tests
  → merge vào fixtures/
  → dùng ở local/CI/staging
```

Fixture không yêu cầu human verification nhưng bắt buộc `is_simulated=true` và prefix `syn_`/`sim_`.

## Quy trình seed production

```text
Seed preparer tạo CSV
  → seed reviewer kiểm tra nội dung/provenance
  → operator chạy validate
  → operator chạy import --dry-run
  → reviewer ký checklist
  → operator chạy production import
  → audit owner kiểm tra summary
```

Không sửa database trực tiếp để “chữa nhanh” record import lỗi. Sửa file nguồn hoặc tạo migration/operations record có audit.

## Output của dry-run

Dry-run cần báo:

- Contract version và checksum file.
- Số record create/update/unchanged/reject.
- Duplicate/conflict.
- Foreign key không tồn tại.
- Distribution theo `data_type` và `is_simulated`.
- Production guard violations.
- Không ghi bất kỳ record nào.

## Error policy

- Schema/type/guard error: từ chối toàn bộ file.
- Duplicate ID cùng nội dung: báo unchanged.
- Duplicate ID khác nội dung: conflict, không tự ghi đè.
- Provider mapping conflict: dừng import.
- Record-level content warning: có thể tiếp tục dry-run nhưng production cần reviewer xác nhận.
- Production import phải transactional: hoặc ghi toàn bộ batch hợp lệ, hoặc rollback.

## Audit record tối thiểu

```text
import_id
contract_version
file_name
file_checksum
environment
operator_id
started_at
completed_at
created_count
updated_count
rejected_count
status
```

Không đưa raw personal data hoặc free-text note vào log.

## Quyền truy cập

- Local/CI fixtures: developer.
- Research workspace: researcher/founder được cấp quyền.
- Production seed file: preparer, reviewer và operator.
- Production credential: chỉ operator; không lưu trong repository.
- Community reports: đi qua authenticated API, không qua spreadsheet thông thường.

## Hoãn Admin Dashboard

CSV + script là luồng chính của MVP. Chỉ cân nhắc Admin Dashboard khi có một trong các tín hiệu:

- Trên 20 thao tác sửa/duyệt mỗi tuần.
- Có từ hai curator không quen CLI.
- Moderation backlog vượt khả năng xử lý bằng operations script.
- Sai sót CSV lặp lại dù validation đã đầy đủ.
