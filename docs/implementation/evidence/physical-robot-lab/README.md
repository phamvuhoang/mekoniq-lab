# Physical Robot Lab — evidence index (07/11/2026)

Chỉ ghi những gì đã chạy thật trên host macOS arm64 (Node 24.22.2). **Không có gate G1/G2/G3, distribution hay hardware nào được đóng.** Mọi mục native là `not_run` kèm blocker; mô phỏng không được nâng thành bằng chứng phần cứng.

Commits: source `d881c6f` → `54bf203` (gồm một đợt sửa sau review độc lập); Lab `679a239` → `9e1e712` (+ cập nhật README này). Baseline NR01–NR12 trước thay đổi: [compatibility.json](compatibility.json).

## Trạng thái theo task

| Task | Portable | Native / UI còn mở |
|---|---|---|
| A01 contracts | **xong** — 5 schema + generated types, validator, fixtures; test contracts | — |
| A02 catalog | **xong** — loader có hash/license/closure, importer có allowlist, catalog tham chiếu; FD01 AMR tham chiếu resolve+compile | Chưa import vendor thật; xArm/G2 `not_run` (`robotics/catalog/vendor-compatibility.json`) |
| A03 resolver | **xong** — assembly, quán tính (đối chiếu số độc lập), BOM, `EngineeringCompileInput` | `PAYLOAD_EXCEEDED` chưa có (catalog chưa có payload rating) |
| A04 bundle store + gateway | **xong** — compile/manifest/blob, create-run, reclaim, readiness theo `engineeringRef`; CLI runtime có opt-in `--engineering-catalog/--engineering-simulation/--engineering-python` (không cờ ⇒ không có capability; thiếu compiler ⇒ không khởi động) | Artifact chưa mang catalog/compiler (phân phối riêng); Lab pin runtime vẫn là bản cũ chưa có engineering |
| B01 môi trường native | Validator + lock candidate + runbook | **not_run**: host không đủ dung lượng VM (22,9 GB < 120 GiB), chưa có Linux/ROS; chưa chụp inventory, chưa có smoke |
| B02 compiler | **xong** — `compiler/engineering.py`, golden V17, parity hash TS↔Python | Chưa chạy trong Gazebo |
| B03 vật lý + routing | Resolver `requiredBackends(target,mode,set,catalog)`, health theo set, ingest `PhysicsSample`, logic worker thuần, CLI `--engineering-project` | **not_run**: launch file, worker thật, lifecycle native, FD01 9 runs (G1) |
| B04 actuator | Mô hình thuần + vector dùng chung | Plugin không build; V06/V07 native `not_run`; actuator khai báo `ideal` |
| C01 arm | `validate_plan`, `vendor.lock.json` (chưa pin) | Package ROS, MoveIt/ros2_control, V08 `not_run` |
| C02 contact | `assess_transfer` (ngưỡng đã kiểm bằng mutation) | Hợp đồng SDF cup/jaw, V09/V10 `not_run` |
| C03 process | `step_process`/`observe`, bảo toàn khối lượng | Cập nhật khối lượng cup trong engine, V11 `not_run` |
| C04 BV01 | — | **chưa làm**: cần provider native |
| D01 Lab | Store, repository, archive, client, candidate, estimates, renderer + **trang Lắp ráp** (chọn linh kiện, mount/connect, blocker xem trước, undo/redo, lưu/tải lại, xuất/nhập, candidate, nút compile khi runtime có capability, BOM/cảnh compile) VI/JA/EN; `engineering-design.spec.ts` (7) và `legacy-campaign.spec.ts` (3) pass | Compile + xem cảnh **chưa kiểm trên trình duyệt** (cần runtime có `engineering_bundle_v1`; phần client/gateway đã có test); chưa có chọn link/joint/port inspector và exploded view |
| D02 evidence | Source `assessEngineeringEvidence` + schema | Nối vào report/replay/compare của Lab; `engineering-run.spec.ts` native |
| D03 distribution | Exporter đóng gói schema; recorder `--suite physical-robot-lab --out` (root mới, không bao giờ ghi đè/ghi vào root cũ) và acceptance đọc `LAB_V2_REGRESSION_DIR` — có test | **Chưa ghi nhận lần record cuối**: cần cây Lab sạch (README/docs plan+spec của bạn đang chưa commit), export sạch + pin runtime mới, rồi record + acceptance; campaign `engineering-qualification`, clean-machine/offline-native, tamper/rollback của closure chưa làm |
| D04 calibration | Schema, `assessCalibration`, CLI, protocol | **G3 not_run**: chưa có dataset đo thật |

## Kết quả đã chạy (host, không native)

- Source: `pnpm contracts:check`, `tsc --noEmit`, `pnpm lint` sạch; `test:unit` 181 pass; `test:contracts` 51 pass; Python `pytest robotics/simulation/tests` 173 pass (1 skip có sẵn); các suite `lab-v2-*`, `lab-runtime*`, `engineering-*` pass (524 test ở lần chạy B03).
- Lab: `pnpm test` 235 pass, 1 skip có sẵn (baseline 188/1); `pnpm typecheck`, `pnpm build` pass.
- Browser (host, không runtime): `playwright test` 34 pass, 12 skip (cần runtime). Qua mock launcher: twin-workspace, coffee-journey, twin-recovery, twin-inputs, fault-schedule, arm-simulation, twin-plan01 đều pass; `legacy-campaign` 3 pass; `test:runtime-e2e` 1 pass; offline-bv01 + twin-recovery trên bundle offline pass; benchmark 60 s: desktop-3d p95 16,8 ms, tablet-2d-emulated 16,7 ms (ngưỡng 33/50) — `ui-performance.json`.
- Chưa chạy: các suite source cần Postgres/Supabase (Docker tắt: `ECONNREFUSED 127.0.0.1:57422`), recorder/acceptance bản cuối, kiểm trên máy sạch/ngắt mạng.

## Review độc lập (1 lần, toàn bộ source diff) và kết quả

Sáu lỗi Critical/Important đã sửa, mỗi lỗi có test đỏ trước: `aborted` bị báo pass; mẫu thiếu `cupId/epoch` được coi là bằng chứng; mẫu trùng/lặp tính vào coverage; xác nhận kẹp qua khoảng trống dữ liệu; engineering set nhận run/readiness không có bundle ref (và health báo supported khi runtime không có capability); cổng mount không chọn được link chuyển động của cha (thêm `Port.link`). Minor chưa sửa: xem mục cuối.

## Việc đã sửa trong lúc làm (phát hiện nhờ kiểm chéo)

- A03 sinh `lineId` BOM chứa `@`, vi phạm chính schema `EngineeringId`; chỉ validation Python lộ ra. Nay `prepareEngineeringCompileInput` tự validate đầu ra theo schema (test đã kiểm bằng mutation).
- Catalog tham chiếu có pin/khay xuyên nhau (resolver `INITIAL_PENETRATION` phát hiện); đã sửa hình học mount.

## Quyết định (rulings) nằm ở `.superpowers/sdd/01-components-assembly/progress.md` (cục bộ, không commit).

## Đợt sửa thứ hai (review của người dùng: 5 P1, 6 P2, 3 deferred)

Đã sửa, mỗi mục có test đỏ trước: grasp xác nhận khi thiếu contact (hai stream phải phủ toàn bộ khoảng lift/hold); evidence mất phần cuối vẫn pass (manifest khóa `window` và `lastSequence`, thiếu → `EVIDENCE_TRUNCATED`); digest tùy ý nâng lên `verified` (cần bản ghi calibration thật: hash khớp, pass, đúng `configDigest`, chưa bị invalidated, đúng capability và miền quan sát); calibration đếm trial không có dữ liệu (`TRIAL_WITHOUT_DATA`); save race ghi bytes sai (snapshot đồng bộ trước validate); projection chọn sai root link; catalog không kiểm provenance (`PROVENANCE_UNRESOLVED`); archive không kiểm assets/recipes và trường quyền/secret; renderer không truyền transform qua cây frame; estimates ném exception với model blob sai; estimate khi thiếu component. Cùng đợt: process vượt deadline không còn xả cả `dt`, mọi cleanup đều chạy, queue từ chối mẫu sau overflow kể cả sau `drain`.

Số liệu sau đợt này: source vitest (lab-*/engineering*/contracts) 64 file, 555 pass, 2 skip có sẵn; pytest 360 pass, 1 skip; Lab 223 pass, 1 skip.

## Đợt sửa thứ ba (2 P1, 2 P2)

`verified` nay so miền calibration với **toàn bộ** quan sát của run (mọi entity, mọi giá trị theo tên), không phụ thuộc danh sách checks hay thứ tự của chúng; calibration không nêu miền, hoặc kênh mà run không tạo ra, không xác minh gì. Calibration với policy không có channel hoặc trial không có mẫu luôn fail (`NO_MEASURED_SAMPLES`/`TRIAL_WITHOUT_DATA`). Archive validate asset/recipe theo đúng schema nguồn đầy đủ (đồng bộ `asset-revision`, `coffee-recipe`) rồi mới kiểm hash; recipe hash là hash canonical của recipe bỏ trường `hash`.

## Minor chưa sửa (ghi nhận từ review đầu)

Hai compile song song cùng project có thể va `rename` (500 thay vì trả bundle sẵn có); reclaim/resume không kiểm lại closure; instance chưa bind bị compiler Python từ chối với `COMPILER_FAILED` thay vì mã resolver; URDF 9 chữ số có nghĩa so với `scene.json` đầy đủ.

## Đợt sửa thứ tư (hồi quy O(n²) + foundation còn lại)

Observations của evidence nay là min/max/count theo tên giá trị (72.000 mẫu: ~1,8 s thay vì ~19 s, kết quả không đổi, vẫn thấy một mẫu ngoài miền). Publish song song cùng bundle thành công (rename thua = đã có cùng bytes). Reclaim báo `engineeringClosure` và start/resume bị chặn `ENGINEERING_CLOSURE_MISSING` khi thiếu file. Instance không thuộc entity nào bị resolver báo `INSTANCE_UNBOUND`. URDF ghi đúng double như `scene.json`.
