# MEKONIQ Robot Lab

Phòng lab thiết kế, mô phỏng và kiểm chứng robot nhà hàng: **giao món → pha chế → nấu ăn**.

Hiện tại repository có [HTML kế hoạch kinh doanh](index.html) và bộ spec/plan dưới đây. **Robot Lab chưa được hiện thực.** HTML hiện tại là chuẩn nhận diện; đợt lập kế hoạch này không thay đổi trang.

## Đọc theo thứ tự

1. [Khảo sát code, Drone Lab và OOMWOO](docs/research/2026-11-01-baseline-and-references.md).
2. [Spec sản phẩm, trải nghiệm và kiến trúc](docs/specs/2026-11-01-mekoniq-robot-lab.md).
3. [Hợp đồng với source và đường từ mô phỏng tới robot thật](docs/specs/2026-11-01-source-integration.md).
4. [Implementation plan và các gate nghiệm thu](docs/plans/2026-11-01-mekoniq-robot-lab.md).

**Quyết định đề xuất:** lấy quy trình thiết kế–lắp ráp–kiểm tra–mô phỏng của Drone Lab; giữ màu/style MEKONIQ; dùng domain, contracts và executor trong `../source` làm đường thực thi. OOMWOO là nguồn học hỏi ROS và mô hình cảm biến, không phải chassis nhà hàng được nghiệm thu.

**Ưu tiên:** một robot giao món, một mặt bằng và một hành trình đầu cuối dùng runtime `source`; mở rộng configurator/3D có giới hạn. Không đợi hoàn thiện một CAD editor để tiếp tục W06.

## Ranh giới repository

- `lab/`: web Lab, configurator, mô hình trình bày, scenario, báo cáo, thiết kế và kế hoạch.
- `source/`: domain nhà hàng, schema dùng chung, simulator nghiệp vụ, adapter Valetudo, executor Android/ROS, Gazebo, commissioning. Các thay đổi cần thiết ở đây được liệt kê như phụ thuộc trong plan.
- `trial/`: nguồn tham khảo hành vi và cấu hình do người vận hành xuất; không thay runtime đang chạy.

`lab` là Git repository riêng. Chạy Git tại đúng repository; không stage thay đổi của W05/W06 từ phiên làm việc khác.

## Xem HTML hiện tại

Mở `index.html` trong trình duyệt, hoặc từ `lab/`:

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

Cổng này là đề xuất cho Lab; kiểm tra trống trước khi dùng. Các lệnh build/test của Robot Lab trong plan là giao diện dự kiến, chỉ có sau task tạo chúng. Các cổng vận hành `1880`/`1884` không thuộc Lab.
