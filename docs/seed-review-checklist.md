# Seed review checklist v1

Checklist áp dụng trước mỗi production seed import.

## Ownership

- [ ] Có tên người chuẩn bị dataset.
- [ ] Có tên người review dataset.
- [ ] Có operator chịu trách nhiệm import.
- [ ] Mục đích và phạm vi batch được ghi rõ.

## File và schema

- [ ] File là UTF-8 CSV và dùng contract version hiện hành.
- [ ] Header khớp schema; không có cột lạ hoặc thiếu cột bắt buộc.
- [ ] Không có ID trùng trong file.
- [ ] Foreign key `place_id` tồn tại.
- [ ] Timestamp có timezone và không nằm trong tương lai.
- [ ] Enum, boolean và thang điểm đều hợp lệ.
- [ ] Ghi chú tự do không vượt giới hạn ký tự.

## Place quality

- [ ] Tên, địa chỉ và quận đã được kiểm tra.
- [ ] Tọa độ nằm trong khu vực dự kiến.
- [ ] Không có địa điểm trùng tên/tọa độ chưa được xử lý.
- [ ] Provider mapping có provenance và được phép lưu.
- [ ] Trạng thái `published` chỉ dùng cho địa điểm đủ thông tin.
- [ ] Price range hợp lệ và dùng VND.
- [ ] Size/capacity có provenance hoặc để unknown.
- [ ] Amenities phân biệt rõ `no` và `unknown`.

## Media

- [ ] Mỗi địa điểm có tối đa 5 ảnh active; `sort_order` không trùng.
- [ ] Cover dùng `sort_order=0`.
- [ ] Mọi ảnh có alt text, kích thước và nguồn.
- [ ] `rights_status` cho phép sử dụng ở môi trường đích.
- [ ] Ảnh community đã moderation approved.
- [ ] Không có ảnh synthetic/placeholder trong production batch.

## Data type và an toàn môi trường

- [ ] Không có `data_type=synthetic` trong production batch.
- [ ] Không có `data_type=research` trong production batch.
- [ ] Không có `is_simulated=true` trong production batch.
- [ ] Không có ID prefix `syn_`, `sim_`, `fixture_` trong production batch.
- [ ] Không đổi nhãn dữ liệu để vượt production guard.
- [ ] Editorial report có `verified_by`, `verified_at` và `source_note`.
- [ ] Research conversion, nếu có, đi qua quy trình consent/xác minh riêng.

## Privacy và nội dung

- [ ] Không có email, số điện thoại hoặc định danh cá nhân trong note.
- [ ] Research/community data có consent phù hợp.
- [ ] Không có nội dung sao chép từ review/ảnh bên thứ ba khi chưa có quyền.
- [ ] Log/import manifest không chứa raw personal data.

## Dry-run và phê duyệt

- [ ] Validation command hoàn tất không lỗi.
- [ ] `--dry-run` hoàn tất không ghi database.
- [ ] Create/update/unchanged/reject counts hợp lý.
- [ ] Mọi conflict đã được xử lý hoặc batch bị hoãn.
- [ ] Checksum file và contract version được lưu.
- [ ] Reviewer đã xác nhận import summary.

## Sau import

- [ ] Production import hoàn tất transaction thành công.
- [ ] Audit record được tạo.
- [ ] Spot-check tối thiểu 5 record.
- [ ] Snapshot/reindex cần thiết đã chạy.
- [ ] Có phương án forward-fix nếu phát hiện lỗi.

## Sign-off

```text
Dataset:
Contract version:
Environment:
Prepared by:
Reviewed by:
Imported by:
Dry-run timestamp:
Production import timestamp:
Import ID:
Notes:
```
