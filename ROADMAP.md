# Roadmap triển khai Chốn MVP

Kế hoạch mặc định: 8 tuần cho một developer, ưu tiên responsive web. Mỗi sprint kéo dài một tuần và phải tạo được phần mềm có thể demo.

## Sprint 0 — Validation và prototype

### Mục tiêu

Xác nhận người dùng hiểu và cần tìm kiếm theo vibe trước khi đầu tư backend.

### Công việc

- [ ] Phỏng vấn 10–15 người thuộc persona chính.
- [ ] Thu thập 20 câu tìm kiếm địa điểm thật.
- [ ] Chốt sáu chiều vibe và từ ngữ tiếng Việt.
- [ ] Thiết kế prototype mobile cho explore, result và contribution.
- [ ] Test prototype với ít nhất 5 người.
- [ ] Curate danh sách 50 quán đầu tiên.
- [ ] Chốt CSV schema và người chịu trách nhiệm review seed.
- [ ] Thu 20–40 report `research` từ trải nghiệm thật của người tham gia.
- [ ] Tạo fixtures `synthetic` cho prototype, ranking và edge case.

### Gate

Ít nhất 4/5 người test hoàn thành luồng tìm địa điểm không cần hướng dẫn và cho biết kết quả dễ quyết định hơn cách họ đang dùng.

## Sprint 1 — Foundation

- [ ] Khởi tạo Next.js/TypeScript, lint, format và test.
- [ ] Thiết lập PostgreSQL/PostGIS và migrations.
- [ ] Tạo schema `places`, `place_areas`, `vibe_reports`.
- [ ] Tạo script validate/import POI và seed CSV, có `--dry-run`.
- [ ] Lưu provenance và mapping ID của provider.
- [ ] Production importer từ chối `synthetic` và `research`.
- [ ] Test bốn `data_type` và quy tắc môi trường.
- [ ] Thiết lập CI chạy typecheck, lint và test.

### Demo

Ứng dụng hiển thị danh sách địa điểm seed từ database.

## Sprint 2 — Explore map/list

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
- [ ] Hiển thị vibe dimensions, report count và confidence.
- [ ] Unit test aggregation/confidence.

### Demo

Trang quán thay đổi vibe khi chọn thời gian dự định ghé.

## Sprint 4 — Discovery và ranking

- [ ] Bộ lọc vị trí, thời gian và ba mục đích.
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
| Ranking | Xếp hạng giải thích được theo ba mục đích |
| Contribution | Thu report nhanh, có confidence và moderation |
| Measurement | Đo được funnel và chất lượng dữ liệu |

## Quyết định cần chốt trong Sprint 0

1. Tên chính thức và domain.
2. Sáu chiều vibe có dễ hiểu với người Việt hay không.
3. Nguồn POI/tile và điều khoản sử dụng dữ liệu.
4. Ba quận thử nghiệm có đủ thuận tiện cho nhóm curate hay không.
5. Có yêu cầu xác minh vị trí cho mọi report hay chỉ tăng trọng số.
6. Tiêu chí nào chứng minh người dùng thực sự có ý định ghé.
7. CSV schema và quy trình ai chuẩn bị, ai review, ai chạy import.
8. Consent và tiêu chí xác minh để chuyển `research` thành `editorial` hoặc `community`.
