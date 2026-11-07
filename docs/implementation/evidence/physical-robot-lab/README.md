# Physical Robot Lab — evidence index (07/11/2026)

Chỉ ghi những gì đã chạy thật trên host macOS arm64 (Node 24.22.2). **Không có gate G1/G2/G3, distribution hay hardware nào được đóng.** Mọi mục native là `not_run` kèm blocker; mô phỏng không được nâng thành bằng chứng phần cứng.

Commits: source `d881c6f` → `54bf203` (gồm một đợt sửa sau review độc lập); Lab `679a239` → commit chứa README này. Baseline NR01–NR12 trước thay đổi: [compatibility.json](compatibility.json).

## Trạng thái theo task

| Task | Portable | Native / UI còn mở |
|---|---|---|
| A01 contracts | **xong** — 5 schema + generated types, validator, fixtures; test contracts | — |
| A02 catalog | **xong** — loader có hash/license/closure, importer có allowlist, catalog tham chiếu; FD01 AMR tham chiếu resolve+compile | Chưa import vendor thật; xArm/G2 `not_run` (`robotics/catalog/vendor-compatibility.json`) |
| A03 resolver | **xong** — assembly, quán tính (đối chiếu số độc lập), BOM, `EngineeringCompileInput` | `PAYLOAD_EXCEEDED` chưa có (catalog chưa có payload rating) |
| A04 bundle store + gateway | **xong** — compile/manifest/blob, create-run, reclaim, readiness theo `engineeringRef` | CLI runtime chưa dựng service (chưa quảng bá `engineering_bundle_v1`) |
| B01 môi trường native | Validator + lock candidate + runbook | **not_run**: host không đủ dung lượng VM (22,9 GB < 120 GiB), chưa có Linux/ROS; chưa chụp inventory, chưa có smoke |
| B02 compiler | **xong** — `compiler/engineering.py`, golden V17, parity hash TS↔Python | Chưa chạy trong Gazebo |
| B03 vật lý + routing | Resolver `requiredBackends(target,mode,set,catalog)`, health theo set, ingest `PhysicsSample`, logic worker thuần, CLI `--engineering-project` | **not_run**: launch file, worker thật, lifecycle native, FD01 9 runs (G1) |
| B04 actuator | Mô hình thuần + vector dùng chung | Plugin không build; V06/V07 native `not_run`; actuator khai báo `ideal` |
| C01 arm | `validate_plan`, `vendor.lock.json` (chưa pin) | Package ROS, MoveIt/ros2_control, V08 `not_run` |
| C02 contact | `assess_transfer` (ngưỡng đã kiểm bằng mutation) | Hợp đồng SDF cup/jaw, V09/V10 `not_run` |
| C03 process | `step_process`/`observe`, bảo toàn khối lượng | Cập nhật khối lượng cup trong engine, V11 `not_run` |
| C04 BV01 | — | **chưa làm**: cần provider native |
| D01 Lab | Store, repository (DB riêng), archive, client Twin, candidate, estimates, scene renderer — 217 test Lab pass | **chưa làm**: nối App/UI editor lắp ráp, i18n, `engineering-design.spec.ts`, `legacy-campaign.spec.ts` |
| D02 evidence | Source `assessEngineeringEvidence` + schema | Nối vào report/replay/compare của Lab; `engineering-run.spec.ts` native |
| D03 distribution | Exporter đã đóng gói 6 schema mới | Recorder `--suite/--out`, acceptance root, campaign `engineering-qualification`, offline/clean-machine: **chưa làm** |
| D04 calibration | Schema, `assessCalibration`, CLI, protocol | **G3 not_run**: chưa có dataset đo thật |

## Kết quả đã chạy (host, không native)

- Source: `pnpm contracts:check`, `tsc --noEmit`, `pnpm lint` sạch; `test:unit` 181 pass; `test:contracts` 51 pass; Python `pytest robotics/simulation/tests` 173 pass (1 skip có sẵn); các suite `lab-v2-*`, `lab-runtime*`, `engineering-*` pass (524 test ở lần chạy B03).
- Lab: `pnpm test` 217 pass, 1 skip có sẵn (baseline 188/1); `pnpm typecheck`, `pnpm build` pass.
- Chưa chạy trong đợt này (bắt buộc ở D03 trước phát hành): Playwright (`ui`, `brand-*`, `controller-report`, `twin-*`, `fault-schedule`, `offline-bv01`), `test:runtime-e2e`, benchmark `measure-twin-ui`, recorder/acceptance.

## Review độc lập (1 lần, toàn bộ source diff) và kết quả

Sáu lỗi Critical/Important đã sửa, mỗi lỗi có test đỏ trước: `aborted` bị báo pass; mẫu thiếu `cupId/epoch` được coi là bằng chứng; mẫu trùng/lặp tính vào coverage; xác nhận kẹp qua khoảng trống dữ liệu; engineering set nhận run/readiness không có bundle ref (và health báo supported khi runtime không có capability); cổng mount không chọn được link chuyển động của cha (thêm `Port.link`). Minor chưa sửa: xem mục cuối.

## Việc đã sửa trong lúc làm (phát hiện nhờ kiểm chéo)

- A03 sinh `lineId` BOM chứa `@`, vi phạm chính schema `EngineeringId`; chỉ validation Python lộ ra. Nay `prepareEngineeringCompileInput` tự validate đầu ra theo schema (test đã kiểm bằng mutation).
- Catalog tham chiếu có pin/khay xuyên nhau (resolver `INITIAL_PENETRATION` phát hiện); đã sửa hình học mount.

## Quyết định (rulings) nằm ở `.superpowers/sdd/01-components-assembly/progress.md` (cục bộ, không commit).

## Minor chưa sửa (ghi nhận từ review)

Hai compile song song cùng project có thể va `rename` (500 thay vì trả bundle sẵn có); `Lifecycle.fail` dừng ở cleanup đầu tiên ném lỗi; `EvidenceQueue.put` không kiểm `failed` sau `drain`; `assessCalibration` bỏ qua validation trial không có kênh đo (có thể `pass` với `residuals` rỗng); reclaim/resume không kiểm lại closure; instance chưa bind bị compiler Python từ chối với `COMPILER_FAILED` thay vì mã resolver; URDF 9 chữ số có nghĩa so với `scene.json` đầy đủ; `dt` lớn vượt `maxDurationSec` vẫn xả cả `dt`.
