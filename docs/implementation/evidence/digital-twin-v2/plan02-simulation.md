# Plan 02 — simulation layer evidence index

**Software implemented and tested; no SIL run executed.** The recorded host is macOS arm64 without ROS 2 Jazzy, Gazebo Harmonic or LinuxCNC, so every simulation-in-the-loop command below stopped at its prerequisite gate with `not_run` (exit 2). Nothing here promotes R-SIM, G-SIM-NAV, G-SIM-ARM, G-SIM-E2E or any hardware gate; no physics row passes.

Recorded 2026-11-05. Plan: `docs/plans/2026-11-05-digital-twin/02-simulation.md`. Specs: `docs/specs/2026-11-05-digital-twin/`.

## Code identity

| Repository | Value |
|---|---|
| source branch / HEAD | `feat/lab-digital-twin-v2` / `ff6c2eb7aaee4e4214cdfcb9887156301ffb22fa` |
| source plan 02 commits | `02c416a` compile twin worlds from versioned assets · `a8d9e6e` connect isolated Gazebo navigation to lab v2 · `f558db1` record causal simulation clocks and recovery evidence · `d9fcde6` simulate pedestrians and shared robot traffic · `9f20184` validate coffee plant evidence in source domain · `413c40a` couple beverage devices and verified cup transfers · `ff6c2eb` verify food and beverage simulation campaigns |
| lab branch / plan 02 base | `feat/robot-lab` / `730bd1ce5b44848b9becae93f6ab78e7b32329da` (the lab commit that follows carries the fixture, helper, test and these documents) |
| runtime artifact | exported from the clean source checkout with `node scripts/export-lab-runtime.mjs /tmp/mekoniq-lab-runtime-v2` on Node v24.22.2: `dirty:false`, sha256 `274912d1a002a78fe4e2836659022b6b66713e29212d7f4a123fcb36945f88b9`, schema hash `f112425e636254a6c3d20d75d615b696c426c7d2a5fb185c01a1943095fe0ffd`, protocol 1/2 |
| Linux SIL tools digest | `8389988ec02b378a05bb969fc947f9f36d00c74717e82cad89db2b1024a0e6b9` over 31 files of `source/robotics/simulation` (distributed separately with the pinned ROS image; not in `runtime.mjs`) |
| Lab import | `node scripts/import-runtime.mjs /tmp/mekoniq-lab-runtime-v2` then `pnpm check:source` → `Verified source ff6c2eb…; schema f112425e…; protocol 1/2; Node 24` |

## Commands actually executed and their results

All source commands ran from `source/` on Node v24.22.2 (nvm) with pnpm 10.32.1; Python from `source/.venv` (3.13, rfc8785, jsonschema). Supabase/Docker was not running, so the Postgres-backed integration suites were not part of this record.

| Task | Command | Result |
|---|---|---|
| 1 | `.venv/bin/python -m pytest robotics/simulation/tests/test_world_compiler.py robotics/agent/tests/test_robotics_assets.py -q` | 24 passed |
| 2 | `pnpm exec vitest run tests/integration/lab-v2-simulated-navigation.test.ts tests/integration/robot-admission.test.ts tests/integration/lab-runtime.test.ts`; pytest `test_nav2_session.py test_protocol.py` | pass (see ledger lines in the plan workspace); `ros2 launch lab_world.launch.py` **not executed** (blocked_external) |
| 3 | `pnpm exec vitest run tests/integration/lab-v2-sim-clock.test.ts tests/integration/lab-v2-sim-recovery.test.ts`; pytest `test_clock_barrier.py` | pass |
| 4 | `pnpm exec vitest run tests/integration/lab-v2-zone-bridge.test.ts tests/integration/lab-v2-sil-campaign.test.ts tests/unit/lab-sil-cli.test.ts`; pytest `test_dynamic_scene.py test_two_robots.py` | pass; `node scripts/lab-sil.mjs run --scenario FD07/FD03/FD04/FD08 …` → **exit 2 not_run** ([fd07](plan02-sil-fd07.json), [fd03](plan02-sil-fd03.json), [fd04](plan02-sil-fd04.json)) |
| 5 | `pnpm exec vitest run tests/integration/coffee-simulation-evidence.test.ts tests/integration/coffee-simulation-resources.test.ts` | 11 passed; regression 110/110 |
| 6 | `pnpm exec vitest run tests/integration/beverage-simulator.test.ts tests/integration/beverage-handoff.test.ts`; `.venv/bin/python -m pytest robotics/simulation/tests/test_beverage_cell.py test_cup_transfer.py test_arm_swept_path.py -q` | 9 passed; 14 passed; regression 64/64; `lab-sil.mjs run --scenario BV01 --seed 19 --backend-set coffee-simulation` → **exit 2** (`BACKEND_MISSING:linuxcnc_sim,coffee_io_sim`, `SIL_FIXTURE_MISSING`) |
| 7 | `pnpm exec vitest run tests/integration/lab-v2-scenario-matrix.test.ts tests/integration/lab-v2-simulation-report.test.ts tests/integration/lab-runtime-contracts.test.ts tests/integration/lab-runtime-artifact.test.ts tests/unit/lab-sil-cli.test.ts` | 14 passed, 1 skipped (optional latency measurement) |
| 7 | `pnpm contracts:check`; `pnpm typecheck` (source and lab) | no drift; exit 0 |
| 7 | lab `pnpm exec vitest run tests/integration/simulation-capability.test.ts` | 3 passed |
| 7 | `node scripts/lab-sil.mjs run --campaign food-beverage --seed 23 --repeat 3 --out …/campaign` | **exit 2 not_run** — [campaign manifest](plan02-sil-campaign.json): `PREREQUISITE_MISSING` linux/python-deps/compiler/ros2/gz; `SCENARIO_BLOCKED:BV01` and `SCENARIO_BLOCKED:CAMPAIGN-FD02-FD07-BV01-BV03` with `BACKEND_MISSING:linuxcnc_sim,coffee_io_sim|SIL_FIXTURE_MISSING`; expected runs 12, executed 0 |
| 7 | `node scripts/lab-sil.mjs verify --input …/campaign` | exit 2 (not_run is never a pass) |
| 7 | `node scripts/lab-sil.mjs doctor --backend gazebo_nav2 --json` | exit 2 — [doctor](plan02-sil-doctor.json): node24 ok, python3 ok, image-lock ok; linux, python-deps (system python3 without rfc8785), compiler, ros2, gz missing |

## What the software proves and what it does not

- **Proven in software:** world compilation is deterministic and hashed; the worker protocol, Nav2 goal semantics, clock barrier, telemetry ingest, fault schedule, zone bridge and SIL orchestrator behave as specified against protocol doubles; the coffee process model, cup transfer evidence rules and the ARM03 capsule swept-path checker pass their unit/integration tests in TypeScript and Python with cross-runtime hash parity; the scenario matrix covers FD01–FD08, BV01–BV08, SYS01–SYS06 and the campaign; evidence records are schema-valid and separate business pass from physics `not_run`.
- **Not proven:** anything that needs a running Gazebo/Nav2 or LinuxCNC: contacts, separation, physical stop, sensor evidence, closed-loop arm control, plant telemetry from a real worker. The coupling of the beverage cell remains `open_loop_visualization` (mock arm). No hardware readiness, calibrated spill, physical grip or food-safety claim follows from any row here.
- **Known gaps carried to plan 03:** `linuxcnc_sim` backend and the BV01 SIL fixture (`SIL_FIXTURE_MISSING`); a Linux host run of `lab-sil.mjs run --campaign food-beverage`; the Lab UI shows the support matrix only through `src/scenarios/support.ts` (no new screen).
