# Robot Lab — tiến độ thực hiện

Cập nhật: **2026-11-05, sau remediation Plan 01**. Phần mềm mock của F01–F08, R01–R12 và 18 khoảng trống phần mềm trước đây đã được hiện thực và kiểm thử trên các revision dưới đây. Recorder hoàn tất 21 lệnh, tất cả exit 0, không thiếu kết quả; acceptance suite đạt 41/41. **R-MOCK chưa accepted**: Plans 02/03 và các gate con người, Linux, thiết bị vẫn mở.

`Implemented` nghĩa là có code; `tested` cần kết quả chạy gắn đúng revision; `accepted` cần owner duyệt bằng chứng. Không dùng một trạng thái thay cho trạng thái khác.

## Revision đã kiểm chứng

| Thành phần | Giá trị |
|---|---|
| Source / runtime pin | `c1d1ea70e42937d421070674f07d00edc7c41245` |
| Lab regression baseline | `aa70d65fdb72f16b64ee7002fbb05c15ee1e690f` |
| Runtime artifact SHA-256 | `21986126e1949d5f25d5af66952e664fa0c08cc3393de45287c8c64379f223f0` |
| Runtime | Node 24; protocol 1 cho S01, protocol 2 cho digital twin |
| Full regression cuối | **PASS — 21/21 lệnh exit 0, không thiếu kết quả** |
| Acceptance suite / release gate | **41 passed, 0 failed, 0 skipped; R-MOCK chưa accepted, chờ owner review và các gate ngoài phần mềm** |

Danh tính artifact nằm trong [runtime lock](../../config/source-runtime.lock.json). Kết quả và checksum đã ghi tại [regression manifest](evidence/digital-twin-v2/regression/manifest.json), [acceptance JSON](evidence/digital-twin-v2/F08-mock-acceptance.json) và [mock report](evidence/digital-twin-v2/mock-report.md). [Compatibility snapshot](../../config/simulation-compatibility.json) khóa các revision, contract/provider hashes và gate còn mở của lần bàn giao này.

## Phạm vi Plan 01 đã hiện thực

| Phần | Hành vi hiện tại |
|---|---|
| Source authority và coffee | Arrival, fulfillment, inventory, cup custody và effects do source quyết định. R01–R05 xử lý bằng chứng cốc vắng, readiness của arm, đếm quantity, ingredient steps và handoff nguyên tử. Có capacity/headspace, outlier, milk policy, pickup timeout và correction cốc rỗng trước dispense bằng observation mới. |
| Runtime và phục hồi | R06/R07/R11/R12 giữ localization fault, dùng sequence telemetry độc lập tick, tách khoảng cách giữa robot khỏi clearance với tường, đóng stream khi hết phiên. Reclaim kiểm proof và khôi phục đúng project/seed đã lưu, chỉ cho xem/đối soát; nhiều robot phải chọn target rõ ràng. Không tự phát lại lệnh chưa rõ kết quả. |
| Delivery và campaign | Có FD02-cups và campaign hai AMR với food/coffee đồng thời, allocation/custody riêng và contention. Campaign kết thúc sau customer handoff; parking có scenario riêng. |
| Arm model | Có conservative swept capsule collision checker, modeled following error/stop/E-stop/reset. Scene coverage cần profile SI có version, transform/height khai báo và geometry AMR biết được. Không có profile thì chỉ báo self/injected scope; thiếu geometry/pose không tạo clearance pass. |
| Twin, replay và KPI | R08–R10 dựng lại trạng thái theo cursor, repaint freshness khi không có pose mới, tính human wait theo mission/stop. Replay giữ collision/first-failure geometry đúng thời điểm, loại future stop/reset và ghi rõ trace bị cắt. KPI queue/travel/human-wait/cell-busy dựa trên evidence tương ứng. |
| Input và báo cáo | Run khóa project/world/design/configuration/recipe/model/adapter/profile. Report lưu bất biến và báo stale theo scope. Reset tạo run mới từ input đã khóa; run speed chỉ đổi wall-clock pacing. Speed limit AMR là input cho run mới, được đưa vào admission và plant. |
| Packaging | Có bundle theo platform chứa Node, UI/dependencies, runtime/schema đã pin và integrity inventory; chạy bằng Node được đóng gói. Launcher, audit và backup-corruption injection đã được sửa. Hướng dẫn trong [README](../../README.md). |
| Renderer và hiệu năng | Kiểm tra journal/effects độc lập với cadence thực đo 15/60 FPS và renderer bị CDP debugger pause đã pass, kèm bằng chứng không draw trong khoảng pause. Đo 60 s với 2 AMR, arm, 6 bàn trên desktop 3D thực của host Apple M2 Pro/macOS arm64 và tablet 2D emulation; harness bắt lỗi render/page error và thiếu mẫu. Đây không phải kiểm thử chính sách background tab của OS hay tablet vật lý. |

Danh sách đủ 18 hạng mục, R01–R12, các finding RL/AR và test entry points nằm trong [remediation record](../reviews/2026-11-05-plan-01-remediation.md), với [báo cáo chi tiết đã track](../reviews/plan01-remediation-details/lab-report.md). AR01–AR03 đã được sửa trong phạm vi source fixture policy, inactive-AMR scene và replay collision/stop evidence. Kết quả cuối dưới đây bổ sung cho các kiểm tra tập trung đã ghi ở từng report.

| Kết quả cuối đã ghi | Trạng thái |
|---|---|
| Source CI-equivalent | Tất cả lệnh exit 0. Unit **65**, contracts **37**, adapters **50**, integration **689 passed / 0 failed / 1 skip**; Python **178 passed**. |
| Lab | Typecheck/build pass; unit/integration **153 passed / 0 failed / 1 skip**. |
| Browser | UI **12**, twin **7**, mock **2**, S01 **1**, Plan 01 **2**, offline **2** passed; không fail, skip hoặc flaky. |
| Renderer performance, mỗi profile 60 s | Desktop 3D thực trên host: frame p95 **16,8 ms**, paint p95 **19,1 ms**. Tablet 2D emulation: frame p95 **16,7 ms**, paint p95 **1,5 ms**. Cả hai đạt ngưỡng; không có số đo tablet vật lý. |
| Acceptance suite | **41 passed / 0 failed / 0 skipped**. |
| Coverage | **106 dòng: 96 pass, 4 UNSUPPORTED_FIDELITY, 5 NEEDS_HUMAN, 1 BLOCKED_EXTERNAL (Linux), 0 NOT_IMPLEMENTED**. Pass là assertion đã chạy, không phải owner acceptance. |

Một skip ở source integration và một skip ở Lab là các phép đo latency/memory tùy chọn; không dùng skip để đáp ứng dòng pass. Gói offline và hai browser journey đã chạy bằng Node được đóng gói; [offline release record](evidence/digital-twin-v2/plan01-offline-release.json) lưu danh tính/checksum. Kết quả này không thay cho host network-off, cold boot hoặc fresh Linux.

## Gate và giới hạn còn mở

- **R-MOCK / G-MOCK:** phần mềm đã hiện thực và kiểm thử; evidence cuối đã ghi, chưa có owner acceptance. Usability với ít nhất 5 người mới, fresh macOS profile, host network-off và cold boot cần người thực hiện. Không mô phỏng người dùng để đóng gate.
- **Linux, R-SIM / G-SIM-*:** fresh Linux chưa có bằng chứng. Plans 02/03 với Gazebo/Nav2 và LinuxCNC chưa triển khai/nghiệm thu; phụ thuộc môi trường Linux và binding evidence mới.
- **Thiết bị / G-HW-READY / G-HW-ACCEPT / G-VENUE:** chưa nghiệm thu. Cần robot/profile đo thực, firmware, map/calibration, stop/payload tests và người vận hành. Hiệu năng tablet vật lý cũng chưa đo.
- **Fidelity:** mock là kinematics/process model minh họa, không chứng minh motion-control performance, sensing, torque, grip force, fluid/spill, physical stopping distance hoặc native safety. Collision pass chỉ áp dụng cho geometry/profile đã khai báo; trace bị cắt không phải lịch sử đầy đủ. Xem [compatibility và phạm vi evidence](../simulation-compatibility.md).
- **L00–L11 và production:** hoàn thành phần mềm Plan 01 không hoàn tất toàn bộ roadmap Lab hoặc nghiệm thu W11. Candidate vẫn là draft; native admission/commissioning, provider/cloud integration, CAD/calibration thật và venue deployment có gate riêng. Nấu ăn vẫn là roadmap; pha chế hiện có mock workflow, chưa là driver thiết bị đã nghiệm thu.

## S01 và các mốc lịch sử

- **2026-11-01 đến 2026-11-04:** bàn giao vertical slice S01 và giao diện Lab, tích hợp runtime source/main rồi re-pin từ `a2f271c` lên `a078777`. S01 dùng `business_sim`, polling và explicit simulation clock; seed của scenario cố định chỉ ghi provenance. Đây là baseline protocol 1, không mô tả giới hạn SSE/replay/campaign của v2 hiện tại.
- **2026-11-05, trước remediation:** bản pin `d473d87` / source test head `e152814` ghi 18 `NOT_IMPLEMENTED`, reclaim 501, chưa có arm collision checker/campaign/offline bundle/UI p95 và một failure backup-corruption injection. Đây là kết quả lịch sử, không phải danh sách thiếu của code hiện tại. Remediation bổ sung phần mềm và sửa injection để luôn đổi byte; bộ regression cuối đã pass như bảng trên.
- Code W00–W11 trong source không tự trở thành scenario hoặc backend Lab. Kho/CRM/chuỗi/provider và production cutover vẫn cần phạm vi kiểm chứng riêng. Xem [index source W00–W11](../../../source/docs/superpowers/plans/2026-10-30-plan-index.json), [Gate D](../../../source/docs/implementation/gates/D-full-scope.md) và [W11-T05](../../../source/docs/implementation/evidence/W11-T05.md).

Bằng chứng cũ: [web MVP](evidence/2026-11-01-web-mvp.md), [tích hợp W06](evidence/2026-11-02-source-main.md), [cập nhật W11](evidence/2026-11-04-source-w11.md). Hash xác nhận nội dung và revision; không tự chứng minh an toàn hay commissioning. Báo cáo giữ input tại lúc tạo, replay không phát lệnh, và kết quả chuyển động chưa rõ vẫn cần đối soát.
