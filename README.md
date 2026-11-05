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

## Chạy digital twin mock bằng một lệnh

Lần đầu trên máy mới (cần mạng một lần để tải dependencies đúng lockfile; runtime source được cài từ artifact đã export):

```sh
pnpm install --frozen-lockfile        # Node 24 (.node-version), pnpm 10.32.1
node scripts/import-runtime.mjs <artifact-dir>   # artifact export từ source sạch, xem bên dưới
pnpm check:source
```

Sau đó, mỗi lần dùng (không cần mạng):

```sh
pnpm lab:mock
```

Launcher chạy **runtime source đã pin** (chỉ backend `mock_amr`, `mock_coffee`, `mock_arm`; không kết nối robot thật) trên `127.0.0.1:4176` và giao diện trên `127.0.0.1:4175`, rồi in mã ghép nối một lần ngay trong terminal. Mở http://127.0.0.1:4175, vào **Twin**, nhập mã (hết hạn sau 5 phút, không nằm trong URL, không lưu vào dự án hay journal), chọn FD01 giao món hoặc BV01 cà phê. Journal nằm trong `runs/` (không commit). `Ctrl-C` chỉ dừng runtime và UI mà launcher đã khởi động.

Launcher không tự tải hay cài gì khi khởi động, không mở bản mô phỏng thay thế khi thiếu runtime, và không bao giờ dừng tiến trình khác. Nó dừng với mã lỗi rõ ràng:

| Thông báo | Nghĩa và cách xử lý |
|---|---|
| `UNSUPPORTED_NODE` | Không phải Node 24. Dùng phiên bản trong `.node-version` (`nvm use`). |
| `UNSUPPORTED_OS` | Chỉ hỗ trợ macOS và Linux (Linux chưa kiểm trên máy mới). |
| `RUNTIME_NOT_INSTALLED` … *preview only* | Chưa cài runtime. Lab chỉ mở ở chế độ xem trước (thiết kế, mặt bằng; không có run/kết quả). Cài bằng `import-runtime.mjs`. |
| `ARTIFACT_HASH_MISMATCH` | Artifact trong `.runtime/` bị sửa. Import lại từ export sạch. |
| `DIRTY_SOURCE_ARTIFACT` | Artifact build từ source có thay đổi chưa commit; bị từ chối. Export lại từ source sạch. |
| `RUNTIME_PROTOCOL_V2_REQUIRED` | Lock đang trỏ artifact chỉ có protocol v1 (S01). Import artifact v2. |
| `DEPENDENCIES_NOT_INSTALLED` | Chạy `pnpm install --frozen-lockfile` một lần. |
| `PORT_IN_USE:4175/4176` | Có tiến trình khác giữ cổng (ví dụ `pnpm dev`/`pnpm runtime` đang chạy). Tự dừng tiến trình đó; launcher không dừng giúp. Kiểm tra: `lsof -nP -iTCP:4176 -sTCP:LISTEN`. |
| `BACKEND_UNAVAILABLE:<id>` / `NON_MOCK_BACKEND_ENABLED:<id>` | Runtime không bật đủ backend mock hoặc bật backend ngoài danh sách mock; launcher dừng runtime vừa mở. |
| `RUNTIME_IDENTITY_MISMATCH` | Runtime đang chạy không khớp commit/schema trong lock. |

Lab không bao giờ dùng cổng `1880`/`1884` (`FORBIDDEN_PORT`). `--ui-port/--runtime-port/--data-dir/--root` chỉ dành cho kiểm thử; runtime source chỉ nhận trình duyệt từ `127.0.0.1:4175`. `node scripts/start-mock.mjs --boot-only` khởi động tới trạng thái sẵn sàng rồi dừng (đo boot-to-ready). Hệ điều hành đã kiểm: macOS (Apple Silicon); Linux chưa kiểm, xem [bằng chứng F07](docs/implementation/evidence/digital-twin-v2/F07-launcher.md).

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

Lock hiện tại ([`config/source-runtime.lock.json`](config/source-runtime.lock.json)) pin source `d473d87af4fa8481e2770976b3385aceff294b52`, nhánh `feat/lab-digital-twin-v2` (F08 final fix wave). Artifact `115cf27168b0ab32579a96ee728c4bcdf52c99ac94d8355e6d0b7855c19aad57` có **protocol 1/2**: S01 v1 vẫn chạy, còn twin dùng v2. `.runtime/rollback.lock.json` giữ **đúng một** pin trước đó, là source `a741e01` (artifact `010f5c65…2606`). Muốn quay xa hơn thì phải export và import lại revision cũ. Runtime chỉ dùng revision trong lock, không tự theo HEAD của source; giá trị máy đọc luôn nằm trong lock, đoạn này chỉ để tham khảo.

Dùng Node 24, dependencies của source và một checkout sạch. Chạy **từ thư mục source**:

```sh
node scripts/export-lab-runtime.mjs /tmp/mekoniq-source-runtime-artifact
```

Nếu `../source/` có thay đổi chưa commit, thêm `--clean-checkout`: exporter tạo git worktree tạm tại `HEAD` đã commit, cài dependencies `--frozen-lockfile --offline` từ store pnpm cục bộ, export rồi xóa worktree; không đụng tới thay đổi đang làm dở. Không dùng `--allow-dirty` cho artifact sẽ import. Exporter cũng từ chối bundle import thứ khác ngoài built-in của Node hoặc chứa mẫu khóa bí mật.

Từ `lab/`:

```sh
node scripts/import-runtime.mjs /tmp/mekoniq-source-runtime-artifact
pnpm check:source
```

Importer là một giao dịch: kiểm metadata, protocol major (Lab hỗ trợ 1 và 2; major lạ bị từ chối `UNSUPPORTED_PROTOCOL`), SHA-256 runtime, băm lại các schema hợp đồng đi kèm so với `schemaHash`, chép vào `.runtime/<sha256>/` qua thư mục staging rồi mới đổi lock bằng một lần rename. Lỗi ở bất kỳ bước nào giữ nguyên lock và artifact cũ. Import lại cùng một SHA thì giữ nguyên thư mục đã kiểm hash. Bản ghi rollback chỉ được ghi (nguyên tử) sau khi lock mới đã thay xong. Importer từ chối artifact build từ source bẩn. Quay lại pin trước: `node scripts/import-runtime.mjs --rollback` (artifact cũ vẫn nằm trong `.runtime/`). Sau mỗi lần đổi lock, chạy `pnpm test`, `pnpm build` và `pnpm test:runtime-e2e`. `pnpm check:source` kiểm tính toàn vẹn artifact đã pin, không kiểm đó có phải HEAD mới nhất hay không. Runtime đóng gói chạy độc lập, không đọc source đang được chỉnh sửa ở bên cạnh. Xem thêm [README runtime source](../source/packages/lab-runtime/README.md) và [bằng chứng cập nhật W11](docs/implementation/evidence/2026-11-04-source-w11.md).

## Kiểm thử

```sh
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e -- ui.spec.ts
pnpm test:runtime-e2e
pnpm test:mock-e2e
pnpm test:twin-e2e
pnpm build
```

`test:mock-e2e` chạy đúng `pnpm lab:mock` với journal tạm cho từng spec, tự lấy mã ghép nối từ terminal của launcher (không nhập tay, mã được che trong log) và chạy FD01 giao món (`twin-recovery.spec.ts`) và BV01 cà phê (`coffee-journey.spec.ts`) qua journal source thật, rồi `Ctrl-C` launcher. `test:twin-e2e` dùng cùng cách cho cả ba spec twin. `test:runtime-e2e` tự mở runtime đã pin với journal tạm, pairing, chạy hành trình thật trên trình duyệt và kiểm report/candidate, sau đó đóng đúng tiến trình và dọn journal của test. Cổng `4176` phải trống; script không tắt runtime của người dùng. Playwright dùng Chrome trên macOS; máy khác đặt `CHROME_PATH` tới Chromium/Chrome. Test S01 trong lệnh Playwright thông thường sẽ được skip nếu thiếu token; chỉ lệnh chuyên dụng ở trên kiểm được tích hợp runtime đầu cuối.

## Phạm vi và bước kế tiếp

Đã có vertical slice source và giao diện MVP; **chưa đạt toàn bộ ma trận G1**. S01 là scenario chạy được; polling có sẵn, SSE và các scenario khác chưa triển khai. Candidate chỉ là draft, không chứa quyền điều khiển, credentials hay hàng đợi mission; readiness không tự nâng thành đã nghiệm thu.

Code W00–W11 đã có trong source/main, gồm POS, robot, kho/nhân sự, CRM/khuyến mãi/đặt bàn, chuỗi/tích hợp và công cụ release. Lab hiện vẫn chỉ mở S01 business simulation; các module mới không tự trở thành scenario hoặc backend Lab. Nối backend native, import/apply candidate và nghiệm thu robot thật là các mốc tiếp theo. W11 có code và kiểm chứng local; UAT, cutover và các gate triển khai thật vẫn chưa được nghiệm thu. Pha chế/nấu ăn hiện là roadmap. Xem [tiến độ và giới hạn cụ thể](docs/implementation/progress.md) trước khi dùng kết quả cho quyết định kỹ thuật.

## Tài liệu

- **[Đề xuất nâng cấp Digital Twin v2 — 2026-11-05](docs/specs/2026-11-05-digital-twin/README.md)**: food delivery + coffee cell (máy pha, đá/sữa, arm), mock/simulation/hardware; [bộ implementation plan](docs/plans/2026-11-05-digital-twin/README.md). Đây là spec/plan chưa triển khai, không thay trạng thái S01 bên trên.

- [Giới thiệu Lab bằng hình ảnh — HTML tương tác, mở offline](../source/artifacts/robot-lab.html): 9 trang, Việt/Nhật/Anh; cấu hình robot, mặt bằng, S01, thử lỗi, replay và xuất draft.
- [Khảo sát Drone Lab/OOMWOO và code nền](docs/research/2026-11-01-baseline-and-references.md).
- [Spec sản phẩm, trải nghiệm, kiến trúc](docs/specs/2026-11-01-mekoniq-robot-lab.md).
- [Hợp đồng source và đường tới robot thật](docs/specs/2026-11-01-source-integration.md).
- [Plan L00–L11 và các gate nghiệm thu](docs/plans/2026-11-01-mekoniq-robot-lab.md).

`lab/` và `source/` là Git repository riêng. `trial/` cùng robot đang vận hành không bị thay đổi bởi Lab.
