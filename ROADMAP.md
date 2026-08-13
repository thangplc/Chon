# Roadmap triển khai Chốn MVP

Kế hoạch mặc định: 8 tuần cho một developer, ưu tiên responsive web. Mỗi sprint kéo dài một tuần và phải tạo được phần mềm có thể demo.

## Sprint 0 — Product definition và prototype

**Trạng thái: hoàn thành ngày 2026-08-13.** User validation được hoãn đến checkpoint trước closed beta.

### Mục tiêu

Chốt mô hình sản phẩm và tạo prototype bằng dữ liệu giả lập trước khi đầu tư backend. Product validation với người thật được chủ động hoãn lại do hạn chế thời gian.

### Công việc

- [x] Chốt sáu chiều vibe và từ ngữ tiếng Việt — taxonomy v1 approved.
- [x] Thiết kế prototype mobile, tablet và desktop cho explore, result/detail và contribution — draft đã tạo.
- [x] Chốt CSV schema và người chịu trách nhiệm review seed — data contract v1.0 approved; founder/developer giữ ba vai trò MVP.
- [x] Tạo fixtures giả lập cho prototype, bốn data workflow, ranking và edge case.

### Deferred — không chặn Sprint 0 hiện tại

- Phỏng vấn 10–15 người thuộc persona chính.
- Thu thập 20 câu tìm kiếm địa điểm thật.
- Test prototype với ít nhất 5 người.
- Curate và xác minh danh sách 50 quán thật.
- Thu 20–40 report `research` từ trải nghiệm thật của người tham gia.

Các task này chưa hoàn thành và không được ghi nhận là validation. Chúng được chuyển sang checkpoint trước closed beta.

### Gate

- Sáu chiều vibe và vocabulary v1 được chốt ở mức giả thuyết.
- Prototype có đủ ba luồng: explore, result/detail và contribution.
- CSV/data contract v1 được chốt.
- Fixtures bao phủ bốn data workflow và các edge case chính.
- Tài liệu ghi rõ product assumptions chưa được kiểm chứng với người thật.

## Sprint 1 — Foundation

Trạng thái: **engineering-complete**. Live coverage là production gate deferred cho provider vibe và không chặn Sprint 2/community-only MVP.

- [x] Thực hiện data-provider spike; chốt POI/tile/geocoding và service-area boundary architecture — FSQ OS Places + MapTiler + OSM boundary; credential coverage smoke test còn là production gate.
- [x] Khởi tạo Next.js App Router/TypeScript strict, Tailwind CSS, ESLint, Prettier và Vitest/Testing Library.
- [x] Thiết lập PostgreSQL/PostGIS và migrations — container healthy trên `5432`; migration chạy thành công và PostGIS spatial smoke test đã pass.
- [x] Tạo schema `service_areas`, `service_area_boundaries`, `place_service_areas`, `places`, `place_areas`, `vibe_reports` — migration, PostGIS indexes và integration verification đã pass.
- [x] Tạo script validate/import boundary, POI và seed CSV, có `--dry-run` — transaction, conflict summary, spatial membership và integration verification đã pass.
- [x] Lưu provenance và mapping ID của provider — `place_sources`, FSQ mapping guards, sync metadata và integration verification đã pass.
- [x] Chốt hybrid vibe architecture — report do người dùng/nhóm Chốn đóng góp và provider signals từ Foursquare Places Pro/Premium, Google Places, Yelp, Tripadvisor được lưu/hiển thị tách provenance.
- [x] Hoàn thành terms desk research, credential audit và schema/migration `provider_vibe_signals` — migration `0004` cùng integration verification đã pass; chi tiết trong `docs/provider-vibe-spike.md`.
- [ ] Chạy live coverage smoke test trên 30 quán cho từng provider — đang chờ credential/commercial hoặc partner approval; chưa provider nào production-ready.
- [x] Production importer từ chối `synthetic` và `research` — fail-closed theo record, có file/row/reason trong summary.
- [x] Production importer từ chối mọi record `is_simulated=true` — áp dụng cho place, place area và vibe report.
- [x] Test bốn `data_type` và quy tắc môi trường — unit test policy và runner production dry-run đã pass.
- [x] Thiết lập GitHub Actions CI chạy typecheck, lint và test — Node 22, pnpm lockfile cache, read-only permissions và concurrency cancellation.

### Demo

Foundation, schema, importer, environment guards và CI đã được verify. UI active đã chuyển sang vertical slice Sprint 2, đọc fixture CSV giả lập qua PostgreSQL.

## Sprint 2 — Explore map/list

Trạng thái: **in progress** — vertical slice đầu tiên dùng pipeline CSV giả lập → PostgreSQL → server repository; chưa gọi provider vibe và chưa tích hợp MapLibre thật.

- [ ] Tích hợp bản đồ và geolocation có xin quyền rõ ràng.
- [ ] Query địa điểm theo bounding box/bán kính.
- [ ] Đồng bộ map và list trên mobile.
- [ ] Cluster marker và tạo trạng thái loading/error/empty.
- [ ] Làm fallback dạng danh sách accessible.

### Demo

Người dùng xem và chọn quán trong ba quận mục tiêu.

## Sprint 3 — Place detail và vibe data

- [ ] Trang chi tiết địa điểm.
- [ ] Hiển thị giờ mở cửa, giá và khu vực trong quán.
- [ ] Implement time buckets và vibe snapshots.
- [ ] Viết provider adapters và normalize signal theo field/storage allowlist của từng nguồn.
- [ ] Implement fusion policy giữa contribution component và provider component, không làm mất provenance.
- [ ] Hiển thị vibe dimensions, report count và confidence.
- [ ] Unit test aggregation/confidence.

### Demo

Trang quán thay đổi vibe khi chọn thời gian dự định ghé.

## Sprint 4 — Discovery và ranking

- [ ] Bộ chọn khu vực hybrid, thời gian chính xác và tám mục đích.
- [ ] Bộ lọc quy mô, tiện ích và khoảng giá.
- [ ] Mapping purpose sang preference weights mặc định.
- [ ] Explainable ranking phiên bản 1.
- [ ] Hiển thị lý do phù hợp/điểm cần lưu ý.
- [ ] Lưu filter vào URL để chia sẻ và đo analytics.

### Demo

Người dùng nhận danh sách xếp hạng khác nhau cho làm việc, đi một mình và hẹn hò.

## Sprint 5 — Contribution

- [ ] Authentication.
- [ ] Luồng vibe report 3 bước, mobile-first.
- [ ] Xác minh gần địa điểm theo lựa chọn của người dùng.
- [ ] Chống spam và rate limit cơ bản.
- [ ] Operational script để ẩn/khôi phục report và ghi audit event.
- [ ] Cập nhật snapshot sau khi report được duyệt.

### Demo

Beta user gửi report trong dưới 15 giây và thấy dữ liệu địa điểm được cập nhật.

## Sprint 6 — Collections và sharing

- [ ] Lưu địa điểm.
- [ ] Tạo collection public/private.
- [ ] Trang collection có metadata chia sẻ đẹp.
- [ ] Collection editorial đầu tiên.
- [ ] Event analytics cho save, share và open directions.

### Demo

Chia sẻ được “10 quán dành cho người thích đi một mình ở Sài Gòn”.

## Sprint 7 — Beta hardening

- [ ] Hoàn thiện 50–100 địa điểm thật.
- [ ] E2E cho bốn luồng quan trọng.
- [ ] Kiểm tra accessibility và mobile performance.
- [ ] Privacy policy, terms và quy trình xóa dữ liệu.
- [ ] Error monitoring, backup và operational checklist.
- [ ] Mời 50–100 beta users theo từng cohort.

### Release gate

- Không còn lỗi blocker trong khám phá hoặc đóng góp.
- 30 địa điểm có dữ liệu vibe đủ dùng.
- P95 API read phù hợp mục tiêu đã đo trên môi trường beta.
- Có dashboard theo dõi funnel khám phá → ý định ghé → đóng góp.

## Sau MVP

Chỉ ưu tiên dựa trên dữ liệu beta:

- Natural-language search.
- “Chọn giúp tôi”.
- Vibe heatmap theo khu vực.
- Recommendation cá nhân hóa.
- Chủ địa điểm xác minh profile và xem insight.
- Admin Dashboard cho POI, import và moderation.
- Mở rộng sang khu vực hoặc loại địa điểm mới.

## Backlog ưu tiên P0

| Epic | Kết quả cần đạt |
|---|---|
| POI foundation | Có 50–100 địa điểm chính xác, import được và truy vết nguồn |
| Temporal vibe | Lưu, tổng hợp và hiển thị vibe theo thời gian |
| Explore | Tìm được địa điểm theo map/list và filter |
| Ranking | Xếp hạng giải thích được theo tám mục đích |
| Contribution | Thu report nhanh, có confidence và moderation |
| Measurement | Đo được funnel và chất lượng dữ liệu |

## Quyết định còn mở sau Sprint 0

1. Tên chính thức và domain.
2. Validation sáu chiều vibe với người dùng thật.
3. Nguồn POI/tile và điều khoản sử dụng dữ liệu.
4. Ba quận thử nghiệm có đủ thuận tiện cho nhóm curate hay không.
5. Có yêu cầu xác minh vị trí cho mọi report hay chỉ tăng trọng số.
6. Tiêu chí nào chứng minh người dùng thực sự có ý định ghé.
7. Consent chi tiết và tiêu chí xác minh vận hành để chuyển `research` thành `editorial` hoặc `community`.

Các mục trên không chặn scaffold Sprint 1. Provider/tile/geocoding phải được chốt trước khi hoàn thành adapter và map integration.
