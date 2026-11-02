# Robot Lab — tiến độ thực hiện

Cập nhật: 2026-11-02. W05/W06 và runtime Lab đã được tích hợp vào source/main; các worktree cũ đã được xóa. Đây là bản bàn giao **vertical slice S01 + giao diện Lab**, không phải tuyên bố hoàn tất toàn bộ plan L00–L11.

## Phần đã hiện thực

| Phần | Kết quả | Phần còn lại trong plan |
|---|---|---|
| L00 | Public schemas source, artifact sạch có commit/schema/hash, importer fail closed, runtime compatibility | Ánh xạ candidate Lab sang profile/units và admission W06 hiện có |
| L01 | 5 màn, VI/JA/EN, IndexedDB, JSON import/export, revisions/undo, mode Preview/business_sim | Migration khi có schema v2; kiểm thử assistive technology đầy đủ |
| L02 | Catalog gọn, 2–4 khay, pin/cảm biến, BOM BigInt, công thức năng lượng/truyền động/CoM, provenance | So sánh hai cấu hình và pin từng component revision; báo giá nhà cung cấp; UI nâng cao cho drive/stability |
| L03 | S01 chạy production domain/store/dispatcher/adapter source, explicit load/handoff, parking riêng, checkpoint recovery | Reclaim phiên cũ trên UI; streaming/cursor |
| L04 | World SI 12×8m, 6 bàn, bếp/parking/dock, kéo/sửa điểm, undo, kiểm footprint/furniture | Background có scale, arbitrary floorplan/CAD, calibration/map binding thật |
| L05 | Procedural 3D, chọn linh kiện/BOM, assembly slider, wiring chức năng, 2D fallback | Benchmark GPU có số đo; pin-level drawings chỉ khi có datasheet |
| L06 | Fault enum cơ bản, source report/journal, tách travel/wait/attempts, replay chỉ đọc | S02–S14, 20-seed matrix, SSE/backpressure; **G1 chưa đạt đầy đủ** |
| L09 phần draft | Candidate với canonical hashes/checksums, evidence refs được lọc, readiness và native action bị chặn | Source dry-run/apply/rollback cho candidate Lab, nối map/profile provisioning W06 |

## Các gate chưa đạt

- **L07 / Valetudo:** adapter, protocol rig và Android executor W06 đã có trong source/main. Còn đăng ký backend protocol/native trong Lab và chạy các scenario tương ứng; Lab chưa gọi adapter Valetudo hoặc robot trial.
- **L08 / Gazebo:** ROS agent/Nav2 và assets simulation W06 đã có trong source/main. Còn nối world compiler/backend Lab và chạy trên Linux/Ubuntu 24.04 + ROS 2 Jazzy/Gazebo Harmonic. Lần cập nhật này kiểm Python bằng fixtures, chưa chạy Gazebo; sơ đồ web không có collision planner.
- **L10–L11 / thiết bị và venue:** cần robot/profile đo thực, firmware, map/calibration, stop/payload tests, người vận hành và gate A/B của source. Trạng thái blocked_external.
- **Pha chế/nấu ăn:** chỉ roadmap, chưa có driver bơm, arm hay heater; cần spec/cell acceptance riêng.

## Quyết định triển khai

1. Ban đầu dùng worktree riêng để giữ checkout W05 đang làm dở. Đã giải quyết ngày 2026-11-02: tích hợp runtime vào source/main có W05/W06, re-pin artifact và xóa worktree. Artifact vẫn chỉ chứng minh revision đã pin; cập nhật source tiếp theo cần build/test lại.
2. Hoàn thành giao diện và S01 trước; các backend native tiếp tục thuộc source/W06. Chi phí: Lab hiện không kiểm chứng navigation/robot thật và không đáp ứng toàn bộ ma trận G1.
3. Semantic point của bàn là **điểm robot bàn giao**, furniture là hình học riêng; source giữ nguyên tọa độ, không trừ thêm offset 0,8m. Chi phí: khi nhập layout theo tâm bàn phải chuyển đổi có chủ đích.
4. Dùng polling và explicit simulation clock cho S01; report ghi sse:false, seed chỉ ghi provenance của scenario cố định. Chi phí: chưa kiểm thử streaming, stochastic dynamics hay độ trễ native.
5. Profile service có footprint minh họa 0,55×0,60m; static clearance dùng đường tròn ngoại tiếp bảo thủ. Valetudo chưa có footprint/khối lượng đo thì giữ unknown. Chi phí: có thể loại bỏ một điểm thực tế đi được, và vẫn cần đo robot thật.

## Vị trí bàn giao

- App: thư mục `lab/`, branch `feat/robot-lab`.
- Runtime source: `source/packages/lab-runtime/`, branch `main`, commit `a2f271c`.
- Worktree source riêng và worktree Lab tạm đã xóa; mỗi repository chỉ còn checkout chính. Journal/ghi chú local cũ được giữ trong `lab/runs/worktree-archive-2026-11-02/` (ignored).
- Đã cập nhật fixture map binding và danh tính observer theo W06; không sửa hay nới kiểm tra production. Chưa push các commit local này.
- Lab đã cài artifact local trong `.runtime/`; chạy `pnpm check:source` để kiểm. Không cần đọc worktree source để chạy artifact đã cài.

## Nguyên tắc bằng chứng

BUSINESS SIM nghĩa là source đã thực thi nghiệp vụ trên adapter giả lập. Report có source commit, journal và attempts thực; arrival không tự tăng số món đã giao. Hash chứng minh tính toàn vẹn nội dung, không chứng minh an toàn hay độ tin cậy của người tạo. Candidate đính kèm tham chiếu report trust:unverified; source vẫn phải kiểm admission và commissioning.

Khi dự án thay đổi, run giữ world của thời điểm tạo; báo cáo được gắn revision cũ. Replay chỉ đọc dữ liệu, không tạo lệnh. Khởi động lại khi kết quả chuyển động không rõ giữ needs_attention/unknown, không tự gửi lại.

Xem [bằng chứng cập nhật main](evidence/2026-11-02-source-main.md), [kiểm thử bản đầu](evidence/2026-11-01-web-mvp.md), [README chạy local](../../README.md) và [plan gốc](../plans/2026-11-01-mekoniq-robot-lab.md). Các checkbox plan gốc không được đánh hoàn tất chỉ vì một phần của task đã có file.
