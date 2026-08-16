# Vibe data policy

Trạng thái: **đã chốt cho MVP — 2026-08-16**.

## Quyết định hiển thị

Chốn chỉ hiển thị **một kết quả “Chốn vibe”** cho mỗi địa điểm và khung thời
gian. Người dùng không thấy hai điểm xếp hạng song song (ví dụ một điểm từ
provider và một điểm từ community), vì điều đó làm giảm khả năng giải thích và
niềm tin vào kết quả.

Việc có nhiều nguồn dữ liệu là policy phía server, không phải hai sản phẩm điểm
số trên UI:

1. `community` và `editorial` đã được duyệt là nguồn chính để tạo kết quả Chốn.
2. Tín hiệu từ provider bên thứ ba được lưu riêng trong
   `provider_vibe_signals`, giữ nguyên provenance và chỉ là nguồn bổ trợ nội
   bộ. API fusion hiện hiệu chỉnh trọng số/confidence rồi xuất ra một kết quả
   Chốn duy nhất; không hiển thị raw provider score.
3. `synthetic` chỉ dùng cho local, CI và staging để phát triển UI/ranking. Nó
   phải được gắn nhãn rõ ràng và không được dùng làm ranking production.

## Quy tắc thiếu dữ liệu

Production không tự thay thế thiếu dữ liệu bằng synthetic. Nếu chưa có đủ
community/editorial (và provider chưa qua production gate), API/UI hiển thị
trạng thái **“Chưa đủ dữ liệu vibe”** cùng số lượng report/confidence hiện có.

Synthetic và dữ liệu thật không được cộng trung bình trực tiếp. Mọi snapshot
hoặc response phải giữ được `sourceDataTypes`, `reportCount`, `confidence` và
`isSimulated` để audit và giải thích kết quả.

## Ma trận môi trường

| Môi trường | POI | Vibe hiển thị | Synthetic |
| --- | --- | --- | --- |
| local / CI | fixture hoặc POI đã import | synthetic fallback được phép | phải gắn nhãn |
| staging | POI đã import | community/editorial; synthetic chỉ khi test được bật rõ ràng | không promote sang production |
| production | POI đã xác minh | community/editorial; provider chỉ sau gate và fusion policy | bị từ chối |

`EXPLORE_PLACE_METADATA_MODE` điều khiển metadata minh họa của POI. Đây là
metadata thử nghiệm (giờ mở cửa, giá, tiện ích, quy mô), không biến thành
vibe thật và không thay thế policy vibe ở trên.

## Ranh giới dữ liệu

- Giữ report Chốn trong `vibe_reports` và provider signal trong
  `provider_vibe_signals`; không đổi provenance provider thành `community` hay
  `editorial`.
- Importer và snapshot rebuild phải tiếp tục áp dụng production guards,
  dry-run và idempotency.
- Fusion policy và UI canonical đã được triển khai ở read path với provider
  ranking flag tắt mặc định. Calibration và việc bật provider production vẫn
  phụ thuộc terms, credential, coverage, attribution và cost gate.
