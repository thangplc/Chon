# Plan phát triển: Chốn

## Nguyên tắc thực thi

- Validation trước implementation.
- Mỗi giai đoạn có đầu ra và điều kiện đi tiếp rõ ràng.
- Build modular monolith; chưa dùng microservices.
- Dữ liệu nhỏ nhưng thật và sâu trước dữ liệu lớn nhưng rỗng.
- Mỗi tuần phải có thứ có thể test hoặc demo.

## Tổng quan

| Giai đoạn | Thời lượng dự kiến | Đầu ra |
|---|---:|---|
| 0. Chốt nền tảng | 1–2 ngày | Context, plan, stack được duyệt |
| 1. Validate vấn đề | 1 tuần | Interview, query corpus, prototype test |
| 2. Product/design foundation | 1 tuần | UX flow, taxonomy, data seed |
| 3. Build core MVP | 4 tuần | Explore, detail, ranking, contribution |
| 4. Beta readiness | 1–2 tuần | Data thật, QA, analytics, privacy |
| 5. Closed beta | 2–4 tuần | Số liệu sử dụng và quyết định tiếp theo |

## Giai đoạn 0 — Chốt nền tảng

### Việc cần làm

- [ ] Review và chốt `CONTEXT.md`.
- [ ] Review phạm vi MVP và non-goals.
- [ ] Review `TECH_STACK.md`, đặc biệt bản đồ, POI và hosting.
- [ ] Chốt schema CSV và trách nhiệm chuẩn bị/duyệt seed data.
- [ ] Chốt những quyết định đang mở có ảnh hưởng tới prototype.

### Exit criteria

- Một câu mô tả sản phẩm thống nhất.
- Một persona chính và ba use case được chốt.
- Không còn quyết định kỹ thuật blocking việc scaffold.

## Giai đoạn 1 — Validate vấn đề

### Việc cần làm

- [ ] Phỏng vấn 10–15 người thuộc persona chính.
- [ ] Thu thập ít nhất 20 câu tìm địa điểm thực tế.
- [ ] Thu thập khoảng 20–40 report `research` từ trải nghiệm ghé quán thật của người tham gia.
- [ ] Tạo dataset `synthetic` riêng để prototype bao phủ use case và edge case; không dùng làm bằng chứng validation.
- [ ] Ghi lại cách họ đang dùng Maps, TikTok, hội nhóm hoặc hỏi bạn bè.
- [ ] Tạo prototype mobile gồm explore, result và contribution.
- [ ] Usability test với ít nhất 5 người.

### Exit criteria

- Ít nhất 4/5 người test hoàn thành luồng chính không cần hướng dẫn.
- Có bằng chứng người dùng quan tâm tới thời gian/vibe, không chỉ rating và khoảng cách.
- Chốt vocabulary cho vibe taxonomy phiên bản 1.
- Dữ liệu `research` và `synthetic` được lưu tách biệt, có nhãn nguồn rõ ràng.

### Nếu không đạt

Không scaffold sản phẩm đầy đủ. Điều chỉnh persona, use case hoặc interaction model rồi test lại.

## Giai đoạn 2 — Product/design foundation

### Việc cần làm

- [ ] Thiết kế mobile-first cho map/list, filter, detail và report.
- [ ] Curate 50 địa điểm đầu tiên.
- [ ] Chốt quy trình lấy POI từ bên thứ ba, mapping ID và cập nhật định kỳ.
- [ ] Định nghĩa CSV schema, validation rules và quy trình import seed.
- [ ] Chốt `data_type` enum: synthetic, research, editorial, community.
- [ ] Thiết lập rule chặn synthetic/research khỏi production import.
- [ ] Chốt time buckets và confidence rules.
- [ ] Viết event tracking plan.
- [ ] Chuẩn bị seed dataset hợp lệ.

### Exit criteria

- Prototype đủ chi tiết để implementation không phải tự đoán UX.
- Seed data có ít nhất 30 địa điểm đã xác minh thủ công.
- File seed vượt qua validation và có thể import lặp lại an toàn trên local/staging.
- Có data dictionary và acceptance criteria cho từng core flow.

## Giai đoạn 3 — Build core MVP

### Tuần 1: Foundation

- Scaffold application, database và CI.
- Schema/migration cho places, areas, reports và snapshots.
- Viết CLI/script validate và import POI/seed CSV; chưa xây Admin Dashboard.
- Ghi `data_type` và provenance cho từng record; provider mapping được quản lý riêng.
- Demo: danh sách địa điểm từ database.

### Tuần 2: Explore và detail

- Map/list đồng bộ, query theo viewport/bán kính.
- Trang chi tiết và chọn thời gian dự định ghé.
- Hiển thị vibe snapshot và confidence.
- Demo: chọn một quán và xem vibe theo thời gian.

### Tuần 3: Filter và ranking

- Filter cho ba use case.
- Explainable weighted ranking.
- Lưu filter trong URL.
- Demo: kết quả thay đổi theo mục đích và thời gian.

### Tuần 4: Contribution

- Auth và luồng report dưới 15 giây.
- Location verification tùy theo quyết định ở giai đoạn 0.
- Moderation tối thiểu bằng trạng thái dữ liệu và operational script, rate limit và snapshot update.
- Demo: gửi report và thấy dữ liệu tổng hợp cập nhật.

## Giai đoạn 4 — Beta readiness

- [ ] Collections và public sharing tối thiểu.
- [ ] Hoàn thiện 50–100 địa điểm thật.
- [ ] Analytics cho explore, detail, save, directions và report.
- [ ] E2E cho bốn luồng quan trọng.
- [ ] Accessibility và mobile performance.
- [ ] Privacy policy, terms và xóa dữ liệu.
- [ ] Monitoring, backup và runbook cơ bản.

### Release gate

- Không có blocker trong explore, detail và contribution.
- Ít nhất 30 địa điểm có dữ liệu đủ dùng.
- Funnel chính đo được end-to-end.
- Có thể ẩn report xấu bằng operational script và lưu audit log; chưa yêu cầu giao diện admin.

## Giai đoạn 5 — Closed beta

### Cách rollout

1. 15–20 người quen thuộc persona để sửa lỗi trải nghiệm.
2. 50 người từ cộng đồng làm việc/học tập tại quán.
3. Tối đa 100 người khi mật độ report đã đủ.

### Review hằng tuần

- Người dùng tìm gì?
- Bao nhiêu kết quả có confidence thấp?
- Người dùng mở chỉ đường nhưng có quay lại đóng góp không?
- Dimension nào thường bị bỏ qua hoặc gây khó hiểu?
- Quán/khu vực nào thiếu dữ liệu?

### Quyết định sau beta

- Tiếp tục: core metrics có tín hiệu và dữ liệu ngày càng tốt.
- Pivot interaction: nhu cầu đúng nhưng cách tìm/filter chưa phù hợp.
- Thu hẹp: chỉ một use case có retention rõ ràng.
- Dừng: người dùng không coi vibe theo thời gian là yếu tố quyết định.

## Thứ tự backlog

### P0 — bắt buộc

1. POI có thể import, đồng bộ và truy vết nguồn.
2. Vibe report theo thời gian.
3. Aggregation và confidence.
4. Explore map/list.
5. Filter và explainable ranking.
6. Contribution và moderation.
7. Analytics funnel.

### P1 — beta tốt hơn

1. Collections.
2. Public sharing.
3. “Chọn giúp tôi”.
4. Search câu tự nhiên chuyển thành filter.

### P2 — sau product signal

1. Cá nhân hóa.
2. Heatmap không khí khu vực.
3. Dashboard cho chủ địa điểm.
4. Mở rộng loại địa điểm hoặc địa lý.
5. Admin Dashboard cho quản lý POI, import, moderation và audit.

## Phân công dữ liệu trong MVP

| Dữ liệu | Nguồn | Người thực hiện | Cách đưa vào hệ thống |
|---|---|---|---|
| POI nền | Provider bên thứ ba | Developer | API/import job theo terms |
| Synthetic | Kịch bản giả lập | Developer | Fixtures/generator, chỉ local/CI/staging |
| Research | Trải nghiệm thật trong Sprint 0 | Research participant | Research form/dataset, không import trực tiếp production |
| Editorial | Nhóm dự án xác minh và curate | Founder/curator | CSV → validation → production import |
| Community | Người dùng đóng góp trên Chốn | Beta user/người dùng | Form trên web/PWA Chốn |

Admin Dashboard chỉ được đưa vào kế hoạch khi quy mô dữ liệu và khối lượng vận hành chứng minh cần thiết.

Research data chỉ được chuyển sang `editorial` hoặc `community` khi có consent, đủ provenance và hoàn tất bước xác minh tương ứng. Không đổi nhãn chỉ để vượt production guard.

Roadmap theo sprint chi tiết hơn được lưu tại `ROADMAP.md`.
