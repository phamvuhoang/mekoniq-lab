# MEKONIQ Robot Lab

Lab thiết kế và mô phỏng nghiệp vụ robot giao món, giữ nhận diện navy/lime và ba ngôn ngữ Việt/Nhật/Anh của MEKONIQ. [Kế hoạch kinh doanh gốc](public/business-plan.html) được lưu nguyên bản.

Bản hiện tại có cấu hình robot, mô hình 3D/2D và lắp ráp, sơ đồ kết nối chức năng, BOM, ước tính năng lượng, trình sửa mặt bằng, báo cáo/replay và xuất candidate dự thảo. Kịch bản S01 chạy qua **domain, SQLite journal, dispatcher và SimulatorAdapter thật trong source**; người dùng phải xác nhận tải món và giao món. Mô hình web không phải bộ mô phỏng động lực học hay bằng chứng robot thật đã chạy.

## Chạy giao diện

Dùng **Node.js 24** và **pnpm 10.32.1**; phiên bản Node nằm trong `.node-version`/`.nvmrc`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Mở **http://127.0.0.1:4175**. Thiết kế, mặt bằng, lưu IndexedDB và xuất dự thảo dùng được khi chưa mở runtime. `pnpm build` tạo website tĩnh trong `dist/`. Trình xem 3D tải khi cần; điện thoại mặc định dùng 2D. Catalog là giả định thiết kế, giá còn thiếu hiển thị rõ; preset Valetudo không tự nhận thông số cơ khí chưa đo.

## Chạy S01 qua source

Runtime được cài riêng trong `.runtime/` và khóa bằng commit/schema/SHA-256 tại [source-runtime.lock.json](config/source-runtime.lock.json). Thư mục runtime và journal không commit vào Git.

Nếu runtime đã được cài trong máy này:

```sh
pnpm check:source
pnpm runtime
```

Giữ terminal này mở. Trong Lab chọn **Kịch bản**, nhập pairing token được in trong terminal (dùng một lần, hết hạn sau 5 phút), rồi tạo run. Trình tự:

1. Bắt đầu → tiến đồng hồ 1 giây → robot đến bếp.
2. Xác nhận tải → tiến 1 giây → robot đến điểm giao bàn.
3. Xác nhận giao → tiến 1 giây → robot về parking.
4. Mở Kết quả, lấy báo cáo; có thể xuất báo cáo hoặc candidate dự thảo kèm tham chiếu bằng chứng.

Mỗi bước di chuyển hoàn tất bằng observation của source simulator. Việc tăng đồng hồ không xác nhận thay con người. Fault injection hỗ trợ blocked/clear, offline/online, reboot và duplicate completion; đây là lỗi nghiệp vụ/giao thức giả lập, không chứng minh khoảng dừng vật lý. Hủy không tự giải quyết hàng còn trên robot.

Runtime chỉ bind `127.0.0.1:4176`; Vite proxy cùng origin. Không dùng cổng vận hành `1880`/`1884`. Cookie/CSRF và ownership bảo vệ run theo phiên. Khi khởi động lại runtime cần pairing lại; UI chưa có chức năng lấy lại run của phiên trước. Journal cũ vẫn nằm trong `runs/` để chẩn đoán, không tự gửi lại lệnh.

### Cài hoặc cập nhật runtime

Từ 2026-11-02, runtime Lab đã được tích hợp vào **source/main**, cùng code W05/W06 sau merge `5ea8db8`. Worktree runtime riêng đã được xóa. Dùng Node 24, dependencies của source và một checkout sạch tại `../source/`, rồi chạy:

```sh
node scripts/export-lab-runtime.mjs /tmp/mekoniq-source-runtime-artifact
```

Từ `lab/`:

```sh
node scripts/import-runtime.mjs /tmp/mekoniq-source-runtime-artifact
pnpm check:source
```

Importer kiểm SHA-256, Node major và metadata; từ chối artifact build từ source bẩn. Kiểm thử lại sau mỗi lần thay source và review thay đổi lock. Runtime đóng gói chạy độc lập, không đọc source đang được chỉnh sửa ở bên cạnh. Xem thêm [README runtime source](../source/packages/lab-runtime/README.md) và [bằng chứng cập nhật main](docs/implementation/evidence/2026-11-02-source-main.md).

## Kiểm thử

```sh
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e -- ui.spec.ts
pnpm test:runtime-e2e
pnpm build
```

`test:runtime-e2e` tự mở runtime đã pin với journal tạm, pairing, chạy hành trình thật trên trình duyệt và kiểm report/candidate, sau đó đóng đúng tiến trình và dọn journal của test. Cổng `4176` phải trống; script không tắt runtime của người dùng. Playwright dùng Chrome trên macOS; máy khác đặt `CHROME_PATH` tới Chromium/Chrome. Test S01 trong lệnh Playwright thông thường sẽ được skip nếu thiếu token; chỉ lệnh chuyên dụng ở trên kiểm được tích hợp runtime đầu cuối.

## Phạm vi và bước kế tiếp

Đã có vertical slice source và giao diện MVP; **chưa đạt toàn bộ ma trận G1**. S01 là scenario chạy được; polling có sẵn, SSE và các scenario khác chưa triển khai. Candidate chỉ là draft, không chứa quyền điều khiển, credentials hay hàng đợi mission; readiness không tự nâng thành đã nghiệm thu.

Code W05/W06, gồm adapter Valetudo, Android executor và ROS 2/Nav2/Gazebo, đã có trong source/main. Lab hiện vẫn chỉ mở S01 business simulation; nối các backend native, import/apply candidate và nghiệm thu robot thật là các mốc tiếp theo. Pha chế/nấu ăn hiện là roadmap. Xem [tiến độ và giới hạn cụ thể](docs/implementation/progress.md) trước khi dùng kết quả cho quyết định kỹ thuật.

## Tài liệu

- [Khảo sát Drone Lab/OOMWOO và code nền](docs/research/2026-11-01-baseline-and-references.md).
- [Spec sản phẩm, trải nghiệm, kiến trúc](docs/specs/2026-11-01-mekoniq-robot-lab.md).
- [Hợp đồng source và đường tới robot thật](docs/specs/2026-11-01-source-integration.md).
- [Plan L00–L11 và các gate nghiệm thu](docs/plans/2026-11-01-mekoniq-robot-lab.md).

`lab/` và `source/` là Git repository riêng. `trial/` cùng robot đang vận hành không bị thay đổi bởi Lab.
