# Robot Lab — tiến độ thực hiện

Cập nhật: 2026-11-04. Lab đã re-pin runtime từ `a2f271c` (W06) lên `a078777` trên source/main, chứa W00–W11 và các sửa lỗi sau review. Đây là bản bàn giao **vertical slice S01 + giao diện Lab**, không phải tuyên bố hoàn tất toàn bộ plan L00–L11 hay nghiệm thu production W11.

## Đối chiếu source W07–W11 với Lab

| Wave source | Code đã có trong source/main | Phạm vi Lab hiện tại |
|---|---|---|
| W07 | Kho, công thức/tiêu hao, mua hàng, kiểm kê, nhân sự/báo cáo | S01 không cấu hình hoặc kiểm chứng các luồng này |
| W08 | Khuyến mãi/voucher, CRM/loyalty, đặt bàn, buffet/combo/cân nhập tay | Chưa có scenario Lab tương ứng |
| W09 | Menu chuỗi, báo cáo/quyền dùng chung, online order sandbox, SDK/Node-RED bridge | Lab không kết nối cloud/provider/Node-RED |
| W10 | Khung provider, payment/e-invoice/channel, adapter VDA 5050 và vendor SDK | Backend Lab vẫn chỉ `business_sim`; conformance emulator không là nghiệm thu thiết bị/provider |
| W11 | Kiểm tra security/load, backup/restore, release/rollback, dispatcher cutover và hồ sơ UAT | Cập nhật runtime không triển khai production hoặc chuyển quyền robot; UAT/cutover còn `blocked_external` |

Nguồn đối chiếu: [index W00–W11](../../../source/docs/superpowers/plans/2026-10-30-plan-index.json), [Gate D](../../../source/docs/implementation/gates/D-full-scope.md), [W11-T05](../../../source/docs/implementation/evidence/W11-T05.md). `applicationImplemented` không đồng nghĩa các gate đã được chấp nhận. L07/L08 vẫn phụ thuộc phần robot W06; các số wave là nguồn sở hữu chức năng, không phải giới hạn revision runtime.

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

1. Ban đầu dùng worktree riêng để giữ checkout W05 đang làm dở. Ngày 2026-11-02 đã tích hợp runtime vào source/main và xóa worktree; ngày 2026-11-04 đã re-pin lên W00–W11 qua clone sạch của committed main. Artifact vẫn chỉ chứng minh revision đã pin; cập nhật source tiếp theo cần build/test lại.
2. Hoàn thành giao diện và S01 trước; các backend native tiếp tục thuộc source/W06. Chi phí: Lab hiện không kiểm chứng navigation/robot thật và không đáp ứng toàn bộ ma trận G1.
3. Semantic point của bàn là **điểm robot bàn giao**, furniture là hình học riêng; source giữ nguyên tọa độ, không trừ thêm offset 0,8m. Chi phí: khi nhập layout theo tâm bàn phải chuyển đổi có chủ đích.
4. Dùng polling và explicit simulation clock cho S01; report ghi sse:false, seed chỉ ghi provenance của scenario cố định. Chi phí: chưa kiểm thử streaming, stochastic dynamics hay độ trễ native.
5. Profile service có footprint minh họa 0,55×0,60m; static clearance dùng đường tròn ngoại tiếp bảo thủ. Valetudo chưa có footprint/khối lượng đo thì giữ unknown. Chi phí: có thể loại bỏ một điểm thực tế đi được, và vẫn cần đo robot thật.

## Vị trí bàn giao

- App: thư mục `lab/`, branch `feat/robot-lab`.
- Runtime source: `source/packages/lab-runtime/`, branch `main`; artifact pin commit `a07877718196ffc88832044fad97b027cedd53f4`. Giá trị máy đọc nằm trong [runtime lock](../../config/source-runtime.lock.json).
- Worktree source riêng và worktree Lab tạm đã xóa; mỗi repository chỉ còn checkout chính. Journal/ghi chú local cũ được giữ trong `lab/runs/worktree-archive-2026-11-02/` (ignored).
- Fixture map binding và danh tính observer W06 vẫn tương thích W11; lần cập nhật này không cần sửa logic runtime hoặc nới kiểm tra production.
- Lab đã cài artifact local trong `.runtime/`; chạy `pnpm check:source` để kiểm. Không cần đọc worktree source để chạy artifact đã cài.

## Nguyên tắc bằng chứng

BUSINESS SIM nghĩa là source đã thực thi nghiệp vụ trên adapter giả lập. Report có source commit, journal và attempts thực; arrival không tự tăng số món đã giao. Hash chứng minh tính toàn vẹn nội dung, không chứng minh an toàn hay độ tin cậy của người tạo. Candidate đính kèm tham chiếu report trust:unverified; source vẫn phải kiểm admission và commissioning.

Khi dự án thay đổi, run giữ world của thời điểm tạo; báo cáo được gắn revision cũ. Replay chỉ đọc dữ liệu, không tạo lệnh. Khởi động lại khi kết quả chuyển động không rõ giữ needs_attention/unknown, không tự gửi lại.

Xem [bằng chứng cập nhật W11](evidence/2026-11-04-source-w11.md), [lần tích hợp W06](evidence/2026-11-02-source-main.md), [kiểm thử bản đầu](evidence/2026-11-01-web-mvp.md), [README chạy local](../../README.md) và [plan gốc](../plans/2026-11-01-mekoniq-robot-lab.md). Các checkbox plan gốc không được đánh hoàn tất chỉ vì một phần của task đã có file.
