# Sprint 0 review pack — approved

Sprint 0 được chốt ngày **2026-08-13**. Technical/product prototype hoàn thành; user validation được hoãn.

## 1. Vibe taxonomy và purpose profiles

- [Vibe taxonomy](docs/vibe-taxonomy.md)
- [Purpose profiles](docs/purpose-profiles.md)

### Cần quyết định

- [x] Giữ sáu chiều: noise, crowd, lighting, privacy, workability, social energy.
- [x] Dùng nhãn “Độ dịu ánh sáng” trong taxonomy v1.
- [x] Dùng nhãn “Nhịp không gian” trong taxonomy v1.
- [x] Giữ `workability` là đánh giá tổng hợp trong v1.
- [x] Contribution dùng thang 5 mức trong v1.
- [x] Chấp nhận trọng số mặc định cho cả tám purpose.

### Sign-off

```text
Decision: approve
Approved taxonomy version: v1
Notes: Chưa validation với người thật.
```

## 2. Mobile prototype

- [Prototype specification](docs/prototype-spec.md)
- Mobile: mở `prototype/index.html`.
- Tablet: mở `prototype/tablet.html`.
- Desktop: mở `prototype/desktop.html`.

### Cần review

- [ ] Explore có đủ purpose, time và district.
- [ ] Result card có đủ lý do, confidence và cảnh báo.
- [ ] Detail có dễ hiểu và không quá nhiều thông tin.
- [ ] Contribution ba bước đủ nhanh.
- [ ] Banner dữ liệu mô phỏng đủ rõ.
- [ ] Tone màu và typography phù hợp tên “Chốn”.
- [ ] Luồng map/list và back navigation hợp lý.
- [ ] Desktop: filter + list + map ba cột hợp lý.
- [ ] Tablet: list/map split view và filter drawer hợp lý.
- [ ] Detail drawer và contribution modal phù hợp màn hình rộng.

### Quyết định UX đã chốt

- [x] Giữ 8 mục đích MVP.
- [x] Khu vực: vị trí hiện tại + tìm kiếm + quận nhanh + map picker và bán kính.
- [x] Thời gian: preset + ngày/giờ chính xác + thời lượng tùy chọn.
- [x] Bộ lọc: quy mô + tiện ích + phân khúc/khoảng giá.
- [x] Mobile: map phía trên + danh sách bottom sheet; desktop: split view.
- [x] Detail: cover + tối đa 5 ảnh, gallery và provenance.

### Sign-off

```text
Decision: approve as Sprint 0 prototype
Approved prototype version: v1 draft reference
Screens/flows to add:
Screens/flows to remove:
Notes:
```

## 3. CSV schema và data operations

- [Data contract](docs/data-contract.md)
- [Data operations](docs/data-operations.md)
- [Seed review checklist](docs/seed-review-checklist.md)

### Phân công đề xuất

| Công việc | Owner |
|---|---|
| Product/data decision | Founder |
| Synthetic fixtures | Developer |
| Production seed preparation | Founder/curator |
| Seed content review | Founder |
| Automated schema review | Import validation script |
| Dry-run và import | Developer/operator |
| Post-import audit | Founder/developer |

### Cần quyết định

- [x] Chấp nhận CSV contract version 1.0.
- [x] Chấp nhận founder và developer là cùng một người trong MVP.
- [x] Chốt Quận 1, Quận 3 và Bình Thạnh cho phạm vi ban đầu.
- [x] Chốt tối thiểu ba trong sáu dimension cho một report hợp lệ.
- [x] Chấp nhận production guard cho data type, simulation flag và fixture prefix.
- [x] Chấp nhận quy trình chuyển research thành editorial/community ở mức contract.

### Sign-off

```text
Decision: approve
Approved contract version: v1.0
Seed preparer: founder/developer
Seed reviewer: founder/developer
Import operator: founder/developer
Notes: POI bên thứ ba đi qua provider pipeline và provenance riêng.
```

## Trạng thái Sprint 0

- Fixtures: hoàn thành.
- Taxonomy/purpose profiles: approved v1.
- Prototype: hoàn thành ở mức Sprint 0 reference.
- Data contract/ownership: approved v1.0.
- User validation: deferred.

Kết luận: **technical/product prototype completed; user validation deferred**.
