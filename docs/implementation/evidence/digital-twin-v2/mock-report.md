# F08: R-MOCK acceptance report (mock evidence)

Status: **partially implemented, tested, not accepted.** The mock-capable `NOT_IMPLEMENTED` rows in §8 still block G-MOCK unless the owner waives them, an owner still has to review this evidence, and the `NEEDS_HUMAN` items are still open. R-SIM and every hardware gate remain `blocked_external` or not started.

## 1. Baseline host and thresholds (fixed before the timing run)

This section was written and committed before the evidence run in §3. During development the checks also ran several times; those runs are not evidence.

| Item | Value |
|---|---|
| Host | Apple M2 Pro, 10 cores, 16 GiB RAM, macOS 26.5 (25F71), darwin arm64 |
| Toolchain | Node v24.22.2 (nvm, user-level), pnpm 10.32.1 |
| Source | branch `feat/lab-digital-twin-v2`. **Pin (artifact commit): `d473d87af4fa8481e2770976b3385aceff294b52`. Final source HEAD: `e15281409065a19669532dc1c659529d65b3959f`.** The commit after the pin is test-only, so the pin stays at the artifact commit; `git diff d473d87..e152814 -- packages/` is empty (verified). Earlier pins were `76960de` and `a741e01` |
| Lab | branch `feat/robot-lab`. Pin commit `78c44bc`, artifact `115cf27168b0ab32579a96ee728c4bcdf52c99ac94d8355e6d0b7855c19aad57`, protocol 1/2. `.runtime/rollback.lock.json` keeps the single previous pin, `a741e01` |
| Clock | virtual mock clock, `tickMs` 20. Sim-time durations come from journal timestamps and the plant log, never from `Date.now()` |

The timing thresholds below are taken from `THRESHOLDS` in `source/tests/acceptance/lab-v2-mock.acceptance.test.ts`, which was committed in `76960de` before the run.

| Threshold | Value | Meaning |
|---|---|---|
| `sameInputDeltaMs` | 0 ms | Two runs with the same input (BV01, seed 11, twice) must give identical sim-time durations: wait, travel, brew, dispense, ready-to-tray and staff wait, plus identical intervention counts |
| `bv01WallMs` | ≤ 30 000 ms per run | Wall-clock budget for one headless BV01 run on this host (process-local `performance.now()`) |
| `fd01WallMs` | ≤ 10 000 ms per run | Wall-clock budget for one headless FD01 run on this host |

Missing or censored durations are reported as `null` with a reason. They never count as 0 and never get a pass badge. Durations that do not apply are listed under `notApplicable`; for example, FD01 has no brew or tray transfer.

Different seeds (FD01 with seed 11 and seed 12) are reported through `compareRuns` (KPI, unit, delta). They are not judged against a threshold, because a seed change is an input change.

## 2. What R-MOCK covers here, and what it does not prove

The mock runs the real source domain/journal (`processCommand`, production registry). The devices and process are modelled: `mock_kinematic` AMR on a footprint grid, `mock_process` coffee cell, and `mock_kinematic` arm. The scene is a live 2D/3D view; fault, replay and compare all work; reports carry a manifest with hashes. **It does not prove motion control, physics, sensing or hardware.** The report coverage flags say so per run: `dynamics`, `nativeExecution`, `physicalStop`, `sensorEvidence`, `armTorque`, `physicalGrip`, `fluidModel` and `armCollisionChecker` are all `false`.

## 3. Evidence run (after the final fix wave)

- Command (source `e152814`, clean, from `source/`):
  `LAB_V2_REQUIRE_LAB_FIXTURES=1 LAB_V2_MOCK_EVIDENCE=<lab>/docs/implementation/evidence/digital-twin-v2/F08-mock-acceptance.json pnpm test:acceptance -- tests/acceptance/lab-v2-mock.acceptance.test.ts`
- Start: 2026-11-05T04:15:40Z. Result: `Tests 41 passed (41)`, duration 76.5 s. Thresholds were unchanged from §1. The timing runs are warm, in-process runs in one vitest worker.
- Machine-readable results: [`F08-mock-acceptance.json`](F08-mock-acceptance.json), sha256 `bfb90ad17efcff0fcba183741fb29a360c06a952edce82228c5721fb6ccd4e1f`. All data is synthetic; a scan found no absolute path or secret string.
- **Per-row records (QA-01).** Each runner or gateway pass row carries `records` with the trace key, the scenario id/revision/hash, the backend set, backend `id@version/model`, the actual outcome and the digest. The check `QA-01 evidence records` asserts this. Granularity is one record per check.
- **Suite-backed rows.** Every `source:` or `lab:` reference must show as **passed** in a stored result listed in [`regression/manifest.json`](regression/manifest.json). The guard re-verifies each file's sha256, and a skipped spec does not count. 49 pass rows cite stored results; 30 rest only on them.
- **Recorder.** The stored results come from [`scripts/record-regression.mjs`](../../../../scripts/record-regression.mjs) (`--ci` adds the source CI-equivalent gate). It scrubs paths and key/token shapes and writes the sha256 manifest. The recorded run used source `d473d87` and lab `0c91b1e`, both clean. The only later source commit is the test-only guard fix `e152814`, which touches no referenced suite.

### Coverage counts (105 rows)

| Status | Rows |
|---|---:|
| pass | 78 |
| not_run `NOT_IMPLEMENTED` | 18 |
| not_run `UNSUPPORTED_FIDELITY` | 4 |
| not_run `NEEDS_HUMAN` | 4 |
| not_run `BLOCKED_EXTERNAL` | 1 |

Pass rows by level: runner 42, browser 10, lab 7, model 7, domain 7, gateway 4, host 1. A `domain` or `model` row is real source code, but not a runner run.

### Coverage table

| ID | Level | Status | Executed check(s) | Evidence | Expected / note |
|---|---|---|---|---|---|
| QA-01 | runner | pass | acc: QA-01 evidence records: every runner/gateway pass row resolves to record… | — | runner/gateway rows resolve to records with scenario id/revision/hash, backend set and backend versions, expected text, actual outcome and digest; suite-only rows resolve to stored machine-readable results with command, timestamp and sha256 — *granularity is one record per check, not per expect(); raw refs are trace keys in F08-mock-acceptance.json and files in regression/manifest.json* |
| QA-02a | runner | pass | source:lab-v2-mock.test.ts — FD01: same seed and inputs give the same canonical outcome, …<br>acc: SYS01 runner: step granularity, pauses and interleaved reads never chang…<br>acc: QA-01 evidence records: every runner/gateway pass row resolves to record… | records: SYS01 (completed)<br>stored: source-referenced.json | run manifest holds project/world/scenario/source/backend set/backend versions/asset content hashes, seed, PRNG and clock |
| QA-02b | runner | not_run `NOT_IMPLEMENTED` | — | — | run manifest holds design, recipe, adapter and config hashes plus calibration/profile revisions — *RunReport.manifest has no design/recipe/adapter/config hash (recipe revision+hash sit on each coffee job, not in the manifest); the mock has no calibration/profile revision* |
| QA-03 | runner | pass | acc: QA-03 stochastic: FD01 and FD02 over 20 fixed seeds hold every invariant…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | records: FD01-seed-1000 (completed), FD02-seed-1000 (completed), FD07@77 (completed), BV01@77 (completed), FD03@77 (completed), FD04-reopen@77 (completed) | same inputs/seed/source give the same normalized trace; 20 seeds for stochastic scenarios, 3 repeats per input |
| QA-04 | runner | pass | acc: SYS01 runner: step granularity, pauses and interleaved reads never chang… | records: SYS01 (completed) | the backend clock executes; step size, pauses and reads never change the domain result — *browser render rate / tab visibility not varied in a test: see SYS01-render* |
| QA-05 | runner | pass | acc: SYS03 runner: duplicate and stale retained completions are absorbed or r…<br>acc: BV05 runner: lost ACK, duplicate completion and a reboot mid-brew: one e…<br>acc: FD04 runner: lane closed while travelling: hold, then NO_PATH attention;…<br>acc: BV02 runner: no cup under the nozzle before start: the job never starts …<br>acc: SYS06 gateway: missing/wrong backend or identity is blocked with a reaso…<br>source:coffee-job.test.ts — reservation is atomic and resources are exclusive<br>source:lab-v2-arm-model.test.ts — joint limits are enforced: a target reachable only outside t… | records: SYS03 (completed), BV05-ack-dup (completed), BV05-reboot (needs_attention), FD04-blocked (needs_attention), BV02-nocup (running), SYS06-created (ready)<br>stored: source-referenced.json | negative cases exist and hold: stale, duplicate, missing ACK, no-path, invalid recipe/joints/cup, backend unavailable |
| QA-06 | gateway | pass | acc: QA-06 transport deny: a full coffee run through the gateway opens no rob…<br>source:lab-v2-stream.test.ts — reading the report and both streams is read-only: command co…<br>lab:report-replay.test.ts — replay is read-only: seek returns recorded events and the po… | records: QA-06 (completed)<br>stored: source-referenced.json, lab-vitest.json | report/replay/import/runs execute no robot/cell/arm/payment/print effect: checked at the transport boundary — *payment/print effects do not exist in the Lab runtime; spies cover net/http/https/dgram/child_process* |
| QA-07 | gateway | pass | acc: SYS06 gateway: missing/wrong backend or identity is blocked with a reaso…<br>lab:mock-launcher.test.ts — an unavailable mock backend fails explicitly and stops the r…<br>lab:mock-launcher.test.ts — missing runtime says preview only and how to install; never … | records: SYS06-created (ready)<br>stored: lab-vitest.json | missing backend/capability/runtime is blocked with a reason; no fallback to a pass |
| QA-08 | runner | pass | source:lab-v2-report.test.ts — compareRuns: same scenario/mode/backends with another seed i…<br>source:lab-v2-report.test.ts — a KPI without data is unavailable with a reason, never 0<br>acc: Timing: two runs compare wait/travel/brew/transfer and interventions aga… | records: Timing-BV01@11 (completed), Timing-FD01@11 (completed)<br>stored: source-referenced.json | metrics carry unit, definition, population; missing data is unavailable, never 0 |
| QA-09a | lab | pass | lab:core-design-world.test.ts — edits coordinates immutably and invalidates old reports and …<br>lab:project-v2-migration.test.ts — an interruption mid-transaction leaves no half-save: backup,… | stored: lab-vitest.json | edits are immutable revisions; migration keeps the old record and rolls back on interruption |
| QA-09b | lab | not_run `NOT_IMPLEMENTED` | — | — | editing model/world/recipe/profile marks v2 run evidence stale by scope — *v2 runs lock their inputs (UX-16) but no scope-based staleness marking of stored v2 evidence exists yet* |
| QA-10 | model | pass | lab:twin-telemetry.test.ts — freshness: heartbeat alive does not refresh a pose that stop…<br>source:lab-v2-model.test.ts — transform convention T_A_B: golden world pose through cell_b…<br>source:lab-v2-arm-model.test.ts — source units convert to SI explicitly: inch->m and deg->rad,…<br>lab:twin-workspace.test.ts — inspector separates observed from commanded, keeps units and… | stored: lab-vitest.json, source-referenced.json | freshness, frames and units checked independently; commanded never stands in for observed |
| QA-11 | browser | pass | lab:twin-recovery.spec.ts — telemetry stream, stale/frozen states, reconnect, read-only …<br>lab:twin-workspace.spec.ts — WebGL disabled and reduced motion fall back to a 2D twin wit…<br>lab:ui.spec.ts — desktop workshop screenshot and WebGL context loss retain co… | stored: lab-pw-twin-twin-recovery.json, lab-pw-ui.json | WebGL loss, disconnect and reload never change command ownership or repeat an effect; history resumes by cursor |
| QA-12 | gateway | pass | acc: SYS06 gateway: missing/wrong backend or identity is blocked with a reaso…<br>acc: QA-06 transport deny: a full coffee run through the gateway opens no rob…<br>source:lab-v2-contracts.test.ts — evidence records only allow the four spec results<br>lab:core-deployment.test.ts — exports hashed inputs without promoting simulation into hard… | records: SYS06-created (ready), QA-06 (completed)<br>stored: source-referenced.json, lab-vitest.json | mock/simulation never promotes a hardware gate; hardware sets are denied in the Lab — *the hardware gate content itself (identity, calibration, owner signature) is H-only: blocked_external* |
| FD01 | runner | pass | acc: FD01 runner: arrival from observations, three legs, served only after ha…<br>acc: QA-03 stochastic: FD01 and FD02 over 20 fixed seeds hold every invariant… | records: FD01 (completed), FD01-seed-1000 (completed), FD02-seed-1000 (completed) | 0 delivered before load/handoff; right allocation; arrival from observation; three traced legs; parks, never charges |
| FD02 | runner | pass | acc: FD02 runner: one batched mission for two tables; confirming table A hand…<br>acc: QA-03 stochastic: FD01 and FD02 over 20 fixed seeds hold every invariant… | records: FD02 (completed), FD01-seed-1000 (completed), FD02-seed-1000 (completed) | confirming table A transfers only A; remaining stop and cargo correct |
| FD02-cups | runner | not_run `NOT_IMPLEMENTED` | — | — | food and coffee cups with their own ids mixed on one tray/mission — *coffee missions carry one cup each; a mixed food+coffee batch is not modelled by the runner (cup ids stay separate per BV01)* |
| FD03 | runner | pass | acc: FD03 runner: a scheduled pedestrian crosses the route; the robot waits/r…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | records: FD03 (completed), FD07@77 (completed), BV01@77 (completed), FD03@77 (completed), FD04-reopen@77 (completed) | a person crossing the route: the robot waits/replans in the model, no penetration, resumes with a recorded cause — *person = scheduled 0.4 m obstacle stepping 0.2 m every 15 ticks; avoidance is the mock hold/replan rule on a geometric grid, not sensing* |
| FD03-sensor | runner | not_run `UNSUPPORTED_FIDELITY` | — | — | reaction to a sensed pedestrian (Nav2/sensor) — *mock_kinematic has no sensors or dynamics; S/H only (G-SIM-NAV blocked_external on this host)* |
| FD04-chair | runner | pass | acc: FD04 runner: chair on the destination: no false arrival, rejected with U… | records: FD04 (needs_attention) | chair on the target: no false arrival, attention with a reason, no teleport |
| FD04-blocked | runner | pass | acc: FD04 runner: lane closed while travelling: hold, then NO_PATH attention;… | records: FD04-blocked (needs_attention) | lane fully closed: hold then NO_PATH attention, no arrival, no contact |
| FD04-reopen | runner | pass | acc: FD04 runner: lane reopened inside the hold window: the robot resumes by …<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | records: FD04-reopen (completed), FD07@77 (completed), BV01@77 (completed), FD03@77 (completed), FD04-reopen@77 (completed) | lane reopened: resume only by policy (inside the hold window), recorded hold and clear |
| FD05-payload | runner | pass | acc: FD05-payload runner: refused before any native start with OVERLOADED; no… | records: FD05-payload (needs_attention) | refused before native start with the right code; no stock change, nothing served |
| FD05-battery | runner | pass | acc: FD05-battery runner: refused before any native start with BATTERY_LOW; n… | records: FD05-battery (needs_attention) | refused before native start with the right code; no stock change, nothing served |
| FD05-capability | runner | pass | acc: FD05-capability runner: refused before any native start with CAPABILITY_… | records: FD05-capability (needs_attention) | refused before native start with the right code; no stock change, nothing served |
| FD05-binding | runner | pass | acc: FD05-binding runner: refused before any native start with TARGET_UNBOUND… | records: FD05-binding (needs_attention) | refused before native start with the right code; no stock change, nothing served |
| FD06-cancel | runner | pass | acc: FD06 runner: cancel while the robot holds the dish: return stop, staff c… | records: FD06 (cancelled) | cancel while holding cargo: mission stops on evidence, cargo explicit, return + staff disposition, never delivered |
| FD06-retarget | domain | pass | source:table-order-amendments.test.ts — moving a table while the robot is en route retargets the mis… | stored: source-referenced.json | retarget while en route: new revision, no stale leg — *domain level only: the Lab action schema has no retarget action, so no runner check* |
| FD07 | runner | pass | acc: FD07 runner: two robots, one narrow corridor: one owner at a time, no un…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | records: FD07 (completed), FD07@77 (completed), BV01@77 (completed), FD03@77 (completed), FD04-reopen@77 (completed) | one corridor owner by policy, no undetected deadlock, both deliver — *the simulator profile serialises on the venue-wide movement zone; granular per-corridor zones are not enabled* |
| FD07-ttl | domain | pass | source:robot-admission.test.ts — an unknown reservation is not released on TTL; a known idle … | stored: source-referenced.json | an unknown reservation is not released by TTL — *domain level only: the mock runner never produces an unknown zone reservation* |
| FD08-localization | runner | pass | acc: FD08 runner: localization lost before arrival: goal unknown, attention, … | records: FD08-localization (needs_attention) | localization lost before arrival: attention, last pose stale, no arrival |
| FD08-map | runner | pass | acc: FD08 runner: map revision changes at a stop: the next leg is refused (MA… | records: FD08-map (needs_attention) | map revision change: next leg refused, pose stale, nothing served |
| FD08-rebind | domain | pass | source:robot-admission.test.ts — a robot reporting a new map mid-mission is held: confirmed c… | stored: source-referenced.json | a new map needs a new binding before dispatch resumes — *domain level: the Lab runner has no map-report/rebind action* |
| BV01 | runner | pass | acc: BV01 runner: both recipes run their own step order; espresso has no ice/…<br>source:coffee-transfer.test.ts — BV01 on mock-default: espresso and iced milk coffee run reci…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | records: BV01 (completed), FD07@77 (completed), BV01@77 (completed), FD03@77 (completed), FD04-reopen@77 (completed)<br>stored: source-referenced.json | recipe steps of the locked revision; espresso without ice/milk; one cup owner; verified dose before pickup; right cup at the table |
| BV02-nocup | runner | pass | acc: BV02 runner: no cup under the nozzle before start: the job never starts … | records: BV02-nocup (running) | no cup: never starts |
| BV02-removed | runner | pass | acc: BV02 runner: cup removed mid-brew: step fails CUP_REMOVED, job held, the… | records: BV02-removed (needs_attention) | cup removed mid-brew: interlock, partial/unknown explicit, never ready |
| BV02-type | domain | pass | source:coffee-job.test.ts — brew only after cup + machine ready, through station-scoped … | stored: source-referenced.json | wrong cup type/id refused — *domain level (CUP_TYPE_MISMATCH, CUP_MISMATCH); no runner fault places a wrong cup* |
| BV02-capacity | domain | not_run `NOT_IMPLEMENTED` | — | — | cup capacity/headspace refused — *recipes and cups carry no capacity/headspace model yet* |
| BV03-milk | runner | pass | acc: BV03 runner: milk runs out: espresso still served, iced milk coffee held… | records: BV03-milk (needs_attention) | ingredient out: other order still served, held with reason, no blind retry |
| BV03-ice | runner | pass | acc: BV03 runner: ice dispenser jammed before its step: the dispense is refus…<br>acc: BV03 runner: ice dispenser jams mid-dispense: the partial amount is meas… | records: BV03-ice-before (needs_attention), BV03-ice-mid (needs_attention) | ice jam: partial kept, held, no second command |
| BV03-contention | runner | pass | acc: BV03 runner: two orders contend for one machine and arm: brews never ove…<br>source:coffee-job.test.ts — reservation is atomic and resources are exclusive | records: BV03-contention (completed)<br>stored: source-referenced.json | two orders on one machine/arm never share it against policy; robot pickup waits for the dock |
| BV04-tolerance | runner | pass | acc: BV04 runner: dose-low: the drink is not ready; requested, observed and a…<br>acc: BV04 runner: measure-unknown: the drink is not ready; requested, observe…<br>acc: BV04 runner: measure-missing: the drink is not ready; requested, observe…<br>source:coffee-job.test.ts — unknown or out-of-tolerance quantity cannot pass automatic q… | records: BV04-dose-low (needs_attention), BV04-measure-unknown (needs_attention), BV04-measure-missing (needs_attention)<br>stored: source-referenced.json | out of tolerance or unknown/missing measurement never becomes ready; requested/observed/accepted separate |
| BV04-timeout | runner | pass | acc: BV03 runner: ice dispenser jammed before its step: the dispense is refus…<br>source:coffee-job.test.ts — a silent device times out its step from the recipe timeout o… | records: BV03-ice-before (needs_attention)<br>stored: source-referenced.json | step timeout on the recipe clock: attention, no resend |
| BV04-outlier | runner | not_run `NOT_IMPLEMENTED` | — | — | sensor outlier rejected by a plausibility rule — *no outlier fault or plausibility filter in mock_process* |
| BV05 | runner | pass | acc: BV05 runner: lost ACK, duplicate completion and a reboot mid-brew: one e…<br>source:coffee-recovery.test.ts — BV05 on mock-default: a cell reboot mid-brew leaves the outc… | records: BV05-ack-dup (completed), BV05-reboot (needs_attention)<br>stored: source-referenced.json | lost ACK / reboot / duplicate id: one effect or unknown + reconcile; no second brew; lifecycle not reset |
| BV06-order | domain | pass | source:coffee-job.test.ts — recipe order is enforced; ice jam halts the workflow; empty …<br>source:coffee-job.test.ts — reservation is atomic and resources are exclusive<br>source:coffee-job.test.ts — a device observation counts only for its own step: another b… | stored: source-referenced.json | wrong step order, recipe/item or hash mismatch refused before the step — *domain level: the runner always submits the locked recipe, so no runner fault produces a mismatch* |
| BV06-capacity | domain | not_run `NOT_IMPLEMENTED` | — | — | capacity/headspace overflow refused — *no capacity/headspace model (same gap as BV02-capacity)* |
| BV07-drop | runner | pass | acc: BV07 runner: arm drops the cup during pick: transfer fails, the cup is n… | records: BV07-drop (needs_attention) | arm/robot never co-own a cup; robot not released without the right cup |
| BV07-dock | runner | pass | acc: BV07 runner: robot docked out of tolerance: no tray transfer, the cup st… | records: BV07-dock (running) | dock out of tolerance: no tray transfer, robot held |
| BV07-cancel | runner | pass | acc: BV07 runner: cancel mid-cycle: the job is cancelled or held with a reaso… | records: BV07-cancel (needs_attention) | cancel mid-cycle: disposition for the cup, nothing delivered |
| BV07-timeout | runner | not_run `NOT_IMPLEMENTED` | — | — | pickup timeout policy — *no pickup/handoff timeout exists in the coffee driver or domain; the robot waits indefinitely (held, never released)* |
| BV08-ready | runner | pass | acc: BV08 runner: machine not ready between StartJob and the brew step: the s… | records: BV08 (completed) | machine not ready blocks the step; only renewed readiness opens it |
| BV08-cleaning | domain | pass | source:coffee-recovery.test.ts — cleaning overdue and stale interlocks block the cell with a … | stored: source-referenced.json | cleaning overdue / stale interlock blocks with a reason until an audited cleaning |
| BV08-milk-policy | domain | not_run `NOT_IMPLEMENTED` | — | — | milk batch/open-time/cold-handling policy and no interlock bypass after reboot — *no milk batch/open-time/cold-handling metadata in recipes or devices; mock reboot keeps device status, so the reboot case is not exercised* |
| CAMPAIGN-FD02+FD07+BV01+BV03 | runner | not_run `NOT_IMPLEMENTED` | — | — | food and coffee concurrently in one versioned workload; queue/travel/human wait/cell busy measured — *no combined food+coffee scenario definition; each part runs and is measured separately* |
| ARM01 | model | pass | source:lab-v2-arm-model.test.ts — FK agrees with the independent Craig oracle at 200 seeded co…<br>source:lab-v2-arm-model.test.ts — IK from a nearby seed converges inside the fixture tolerance…<br>acc: BV01 runner: both recipes run their own step order; espresso has no ice/… | records: BV01 (completed)<br>stored: source-referenced.json | FK independent oracle, seeded IK within tolerance, units/frames; runner arm trace within limits |
| ARM02 | model | pass | source:lab-v2-arm-model.test.ts — IK rejects unreachable targets with a structured result, not…<br>source:lab-v2-arm-model.test.ts — joint limits are enforced: a target reachable only outside t…<br>source:lab-v2-arm-model.test.ts — FK refuses wrong joint vectors and source-unit models | stored: source-referenced.json | out of workspace / joint limit / invalid configuration refused, never clipped |
| ARM03 | model | not_run `NOT_IMPLEMENTED` | — | — | swept-volume collision of links/gripper/held cup, between samples — *no geometric collision checker exists (report coverage armCollisionChecker:false); G-MOCK allows PASS only with a checker* |
| ARM04 | model | pass | source:lab-v2-arm-model.test.ts — near-singular wrist (J5 -> 0, LinuxCNC JOINT_4) is rejected …<br>source:lab-v2-arm-model.test.ts — IK keeps branch continuity along a path and selects the wris…<br>source:lab-v2-arm-model.test.ts — velocity limit rejects a step the joints cannot make in the … | stored: source-referenced.json | near singularity / branch change / velocity limit: continuity kept or refused — *acceleration limits are not modelled* |
| ARM05 | model | not_run `NOT_IMPLEMENTED` | — | — | following error / stop / E-stop then reset without auto-resume — *mock_arm has no following-error or stop model; G-MOCK does not list ARM05* |
| ARM06 | runner | pass | acc: ARM06 runner: arm reboot after an accepted pick: transfer outcome unknow…<br>source:coffee-transfer.test.ts — arm outcome unknown during transfer holds the cup with its l… | records: ARM06 (needs_attention)<br>stored: source-referenced.json | link loss / reboot after accept: no blind resend; unknown holds cup ownership until reconcile |
| SYS01 | runner | pass | acc: SYS01 runner: step granularity, pauses and interleaved reads never chang…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | records: SYS01 (completed), FD07@77 (completed), BV01@77 (completed), FD03@77 (completed), FD04-reopen@77 (completed) | same inputs: same normalized trace regardless of step size/pauses; manifest names the backend set |
| SYS01-render | browser | not_run `NOT_IMPLEMENTED` | — | — | 15/60 FPS render and a background tab leave the trace unchanged — *no browser test varies render rate or tab visibility; the UI is not a clock source by construction (runtime ticks only on step actions)* |
| SYS02-executor | runner | pass | acc: SYS02 runner: executor crash after a committed accept: reopen holds unkn…<br>source:lab-v2-recovery.test.ts — crash after journal commit and before checkpoint reopens as … | records: SYS02 (needs_attention)<br>stored: source-referenced.json | executor crash after accept: no owner change, no duplicate effect, unknown vs stale explicit |
| SYS02-ui | browser | pass | lab:twin-recovery.spec.ts — telemetry stream, stale/frozen states, reconnect, read-only … | stored: lab-pw-twin-twin-recovery.json | UI/gateway loss and reconnect: no duplicate action, lost session explicit |
| SYS02-reclaim | gateway | not_run `NOT_IMPLEMENTED` | — | — | reclaim of a run by a new session/runtime — *POST /runs/:id/reclaim answers 501; a restarted runtime needs re-pairing and a new run* |
| SYS03 | runner | pass | acc: SYS03 runner: duplicate and stale retained completions are absorbed or r…<br>acc: BV05 runner: lost ACK, duplicate completion and a reboot mid-brew: one e… | records: SYS03 (completed), BV05-ack-dup (completed), BV05-reboot (needs_attention) | duplicate / stale retained completions never revive a terminal state or count twice |
| SYS03-reorder | runner | not_run `NOT_IMPLEMENTED` | — | — | reordered/delayed observations — *no reorder/delay fault in the plant adapters (duplicate/stale only)* |
| SYS04 | lab | pass | lab:core-design-world.test.ts — rejects unknown fields, nonfinite numbers and unsupported im…<br>lab:project-store.test.ts — rejects corrupt imports before overwriting a saved project<br>source:lab-v2-recovery.test.ts — clean close and reopen resumes from the checkpoint with the … | stored: lab-vitest.json, source-referenced.json | geometry edit is a new revision; bad/old import refused without damage; saved run reopens with its locked inputs — *scope-based staleness of old v2 reports: see QA-09b* |
| SYS05 | runner | pass | acc: SYS05 runner: reading the report and journal repeatedly is read-only (jo…<br>acc: QA-06 transport deny: a full coffee run through the gateway opens no rob…<br>lab:report-replay.test.ts — replay is read-only: seek returns recorded events and the po…<br>lab:core-deployment.test.ts — rejects live state, credentials and forged validation in can… | records: SYS05 (running), QA-06 (completed)<br>stored: lab-vitest.json | replay/scrub/export/import cause no effect; action-like fields inert or refused |
| SYS06 | gateway | pass | acc: SYS06 gateway: missing/wrong backend or identity is blocked with a reaso…<br>acc: BV05 runner: lost ACK, duplicate completion and a reboot mid-brew: one e…<br>acc: FD08 runner: localization lost before arrival: goal unknown, attention, … | records: SYS06-created (ready), BV05-ack-dup (completed), BV05-reboot (needs_attention), FD08-localization (needs_attention) | backend missing/wrong version/mode change: blocked with reason, no fallback; backend death mid-run held unknown |
| UX-01 | browser | pass | lab:twin-workspace.spec.ts — coffee preset runs on the mock backend with a locked, visibl…<br>lab:mock-launcher.test.ts — missing runtime says preview only and how to install; never … | stored: lab-pw-twin-twin-workspace.json, lab-vitest.json | sample project with food and coffee runs through the source runner; missing runner is explained, never completed |
| UX-01-time | human | not_run `NEEDS_HUMAN` | — | — | start mock within 3 min, complete/report within 5 min, find a fault cause within 2 min (>=5 new users) — *guided usability with representative users cannot be performed by an agent* |
| UX-02 | browser | pass | lab:twin-workspace.spec.ts — layers, legend and one shared selection survive a 3D to 2D s… | stored: lab-pw-twin-twin-workspace.json | 2D/3D of the same run keeps run id, time, selection; no domain action |
| UX-03 | lab | pass | lab:twin-workspace.test.ts — layers toggle overlays and the legend names modeled, observe…<br>lab:twin-workspace.spec.ts — layers, legend and one shared selection survive a 3D to 2D s… | stored: lab-vitest.json, lab-pw-twin-twin-workspace.json | route, target, footprint, occupancy layers with a legend; unknown stays unknown |
| UX-04 | browser | pass | lab:coffee-journey.spec.ts — missing cup: visible reason and entity, confirmed reconcile,…<br>lab:service-journey.spec.ts — paired source runtime drives arrival then human load and han… | stored: lab-pw-twin-coffee-journey.json, lab-pw-runtime.json | mission/cargo/cup/arm state side by side; confirmation names the object |
| UX-05 | browser | pass | lab:twin-recovery.spec.ts — telemetry stream, stale/frozen states, reconnect, read-only …<br>lab:coffee-journey.spec.ts — missing cup: visible reason and entity, confirmed reconcile,… | stored: lab-pw-twin-twin-recovery.json, lab-pw-twin-coffee-journey.json | run/pause/step; an acknowledged pause of the mock clock is not a stop |
| UX-05-reset-speed | browser | not_run `NOT_IMPLEMENTED` | — | — | reset and run-speed control offered by capability mode — *v2 runs have no reset or speed action (a new run is created instead); the Lab action schema has neither* |
| UX-06 | browser | pass | lab:coffee-journey.spec.ts — missing cup: visible reason and entity, confirmed reconcile,… | stored: lab-pw-twin-coffee-journey.json | fault palette shows where/when a fault applied — *one-shot faults from the UI; schedules exist only as server scenario data (FD03/FD04)* |
| UX-07 | browser | pass | lab:twin-workspace.test.ts — inspector separates observed from commanded, keeps units and…<br>lab:twin-workspace.spec.ts — engineering panel shows units, observed versus commanded and… | stored: lab-vitest.json, lab-pw-twin-twin-workspace.json | inspector values with units, source and freshness; unknown never 0 |
| UX-08 | lab | pass | lab:report-replay.test.ts — trace links command -> observation -> business transition fo… | stored: lab-vitest.json | timeline links business events, commands and observations — *the 2-minute find-the-cause target is UX-01-time (NEEDS_HUMAN)* |
| UX-09 | lab | pass | lab:report-replay.test.ts — replay is read-only: seek returns recorded events and the po…<br>lab:report-replay.test.ts — pose interpolation only inside the declared max gap and neve…<br>acc: QA-06 transport deny: a full coffee run through the gateway opens no rob… | records: QA-06 (completed)<br>stored: lab-vitest.json | replay: recorded time/cursor, no execute, gaps marked, no interpolation over the gap |
| UX-10 | lab | pass | lab:report-replay.test.ts — compareRuns: comparable for same scenario/mode/backends; nev…<br>source:lab-v2-report.test.ts — compareRuns refuses to rank mock against hardware, and diffe… | stored: lab-vitest.json, source-referenced.json | compare shows inputs/coverage/samples; never ranks mock against hardware; missing KPI unavailable |
| UX-11 | browser | pass | lab:twin-workspace.spec.ts — mobile layout is operable with the keyboard only<br>lab:twin-workspace.spec.ts — WebGL disabled and reduced motion fall back to a 2D twin wit…<br>lab:ui.spec.ts — mobile and reduced-motion fallback remain accessible without… | stored: lab-pw-twin-twin-workspace.json, lab-pw-ui.json | responsive, keyboard, reduced motion, 2D when WebGL is missing; no run lost on context loss |
| UX-12 | lab | pass | lab:project-store.test.ts — rejects corrupt imports before overwriting a saved project<br>lab:ui.spec.ts — failed huge numeric import keeps the usable current and pers… | stored: lab-vitest.json, lab-pw-ui.json | save/open/import/export with migration and revision; history unchanged — *old-run badge against the current configuration: QA-09b* |
| UX-13 | model | pass | source:lab-v2-model.test.ts — compileAsset derives visual and collision from one geometry …<br>lab:project-v2-migration.test.ts — the catalog fixture, the compiled footprint and the viewer s… | stored: source-referenced.json, lab-vitest.json | one asset/world revision for scene, planner and collision |
| UX-14 | model | pass | source:lab-v2-contracts.test.ts — twin sample states are finite per entity kind, SI units in t…<br>lab:twin-telemetry.test.ts — orders samples per provider by bootId+seq: a late older samp… | stored: source-referenced.json, lab-vitest.json | state samples carry entity, frame, SI unit, sim/wall time, source and sequence |
| UX-15 | domain | pass | source:coffee-transfer.test.ts — cell -> arm needs grasp evidence from the bound arm observer…<br>lab:twin-workspace.test.ts — inspector separates observed from commanded, keeps units and…<br>acc: FD01 runner: arrival from observations, three legs, served only after ha… | records: FD01 (completed)<br>stored: source-referenced.json, lab-vitest.json | desired/commanded, observed and derived stay separate (goal != arrived, dispense != dose, gripper closed != holding) |
| UX-16 | runner | pass | source:lab-v2-recovery.test.ts — clean close and reopen resumes from the checkpoint with the …<br>lab:twin-workspace.test.ts — locked identity shows recipe and project revisions as the ru… | stored: source-referenced.json, lab-vitest.json | a run locks project/scenario/source/backend set; edits never change a running run |
| UX-17 | runner | pass | source:lab-v2-stream.test.ts — telemetry is a separate coalesced stream of schema-valid sam…<br>lab:twin-telemetry.test.ts — freshness: heartbeat alive does not refresh a pose that stop…<br>lab:twin-recovery.spec.ts — telemetry stream, stale/frozen states, reconnect, read-only … | stored: source-referenced.json, lab-vitest.json, lab-pw-twin-twin-recovery.json | continuous telemetry with stale/drop/disconnect marks; heartbeat on a monotonic clock |
| UX-18 | runner | pass | acc: FD04 runner: chair on the destination: no false arrival, rejected with U…<br>acc: FD05-payload runner: refused before any native start with OVERLOADED; no…<br>acc: BV01 runner: both recipes run their own step order; espresso has no ice/… | records: FD04 (needs_attention), FD05-payload (needs_attention), BV01 (completed) | geometry/load/recipe changes act on the model with an explainable effect — *speed-limit changes: see UX-18-speed* |
| UX-18-speed | runner | not_run `NOT_IMPLEMENTED` | — | — | a speed-limit change acts on the model — *mock_amr speed is a fixed illustrative 0.5 m/s; scenario speed limits are not wired into the plant* |
| UX-19 | runner | pass | source:lab-v2-report.test.ts — report separates durable business events from lossy coalesce…<br>acc: QA-06 transport deny: a full coffee run through the gateway opens no rob… | records: QA-06 (completed)<br>stored: source-referenced.json | the report says which engine/model backs each claim; mock never claims physics |
| UX-20 | model | pass | source:coffee-job.test.ts — lab recipe fixtures equal the server recipes, are schema-val…<br>source:lab-v2-model.test.ts — migrateV1Project keeps handoff coordinates, backs the design…<br>acc: BV01 runner: both recipes run their own step order; espresso has no ice/…<br>lab:ui.spec.ts — all three locales fit tablet and desktop, with explicit unme… | records: BV01 (completed)<br>stored: source-referenced.json, lab-pw-ui.json | mock values and measurements carry illustrative/modelled/unknown provenance, never calibrated — *calibration records for real hardware do not exist (H only)* |
| R-MOCK-launcher | host | pass | lab:mock-launcher.test.ts — ready launcher prints the one-use code (never in a URL), mak…<br>lab:mock-launcher.test.ts — a non-mock backend enabled by the runtime is refused | stored: lab-vitest.json | single launcher starts the pinned runtime, refuses non-mock/unavailable backends, makes no outbound connection |
| S01 | browser | pass | lab:service-journey.spec.ts — paired source runtime drives arrival then human load and han… | stored: lab-pw-runtime.json | S01 regression still runs through source domain/journal/dispatcher on the pinned artifact |
| R-MOCK-fresh-macos | host | not_run `NEEDS_HUMAN` | — | — | fresh macOS user profile install + first run — *needs a separate clean user profile on this machine (F07 not_run)* |
| R-MOCK-linux | host | not_run `BLOCKED_EXTERNAL` | — | — | fresh Linux profile install + first run — *no Linux host available (F07 not_run)* |
| R-MOCK-network-off | host | not_run `NEEDS_HUMAN` | — | — | launcher and run with networking disabled — *turning off host networking is outside agent scope (F07 not_run); the transport-deny check (QA-06) covers the runtime side* |
| R-MOCK-offline-bundle | host | not_run `NOT_IMPLEMENTED` | — | — | offline vendored dependency bundle install — *no vendored offline bundle exists (F07 not_run)* |
| R-MOCK-cold-boot | host | not_run `NEEDS_HUMAN` | — | — | boot-to-ready after a host reboot — *requires rebooting the host (F07 not_run; warm p95 608 ms recorded without a pass badge)* |
| UI-perf-p95 | browser | not_run `NOT_IMPLEMENTED` | — | — | p95 frame <= 33 ms desktop / <= 50 ms tablet 2D for 2 robots + 1 arm + 6 tables over >= 60 s — *no frame-time capture harness; F06 measured telemetry latency and heap only* |
| PHYS-grip-spill-stop | runner | not_run `UNSUPPORTED_FIDELITY` | — | — | cup grip, grasp force, spill, stop distance — *mock proves no physics (report coverage physicalGrip/armTorque/fluidModel/physicalStop false)* |
| PHYS-liquid | runner | not_run `UNSUPPORTED_FIDELITY` | — | — | real coffee/milk/ice quantities and brew state — *process model + synthetic measurements only (provenance modelled)* |
| PHYS-contact-dynamics | runner | not_run `UNSUPPORTED_FIDELITY` | — | — | contact/dynamics of robot motion — *mock_kinematic: no dynamics; contacts are geometric overlaps in the model* |

## 4. Stochastic seeds, repeats and timing (rerun in the §3 run)

- **FD01 and FD02, 20 fixed seeds (1000–1019):** all completed (served 1 and 3), with 0 contacts, 0 rejected observations and one confirmed attempt per execute. Each scenario produced 20 distinct drawn `atTick` sets and 20 distinct digests with the seed normalised out.
- **Same-seed repeats (3×), unchanged across all evidence runs:** FD01@1000 `b3f4cb44…6890`, FD02@1000 `adbc6d52…620c`.
- **Deterministic scenarios (3×):** FD07@77 `b31f1ab0…6419`, BV01@77 `006a6c82…1a3c`, FD03@77 `13afb2fe…95d0`, FD04-reopen@77 `c61f5019…3b13`.

### Timing comparison (warm, in-process; sim-time ms on the virtual clock)

| Run | wall ms | travel per leg | guest wait | brew | dispense (ice, milk) | ready → tray | staff wait | interventions (human / scripted, reconciliations, attention) |
|---|---:|---|---|---|---|---|---:|---|
| BV01 seed 11 #1 | 1768 | 4560, 5660, 10220 ×2 | 47460, 84660 | 25500, 25500 | 3500, 4500 | 12260, 12260 | 17360 | 0 / 2, 0, 0 |
| BV01 seed 11 #2 | 1367 | identical | identical | identical | identical | identical | 17360 | 0 / 2, 0, 0 |
| FD01 seed 11 | 66 | 11640, 14000, 4080 | 27640 | n/a | n/a | n/a | 2000 | 0 / 2, 0, 0 |
| FD01 seed 12 | 62 | 11640, 14000, 4080 | 27640 | n/a | n/a | n/a | 2000 | 0 / 2, 0, 0 |

The same-input delta is 0 ms and wall times are within budget. No duration was missing or censored. These are mock-model durations, not a physical baseline.

## 5. Regression run and source CI-equivalent gate (stored, machine-readable)

Recorded with `node scripts/record-regression.mjs --ci` from lab, with the repo's local Supabase started by `pnpm supabase:start` and stopped afterwards by `pnpm supabase:stop`. Another Supabase project on this host was not touched. Paths are scrubbed and each sha256 is of the stored file.

| Run | Repo | Started (UTC) | Exit | Result file (sha256) | Summary |
|---|---|---|---:|---|---|
| source-typecheck | source | 2026-11-05T03:57:25 | 0 | log `source-typecheck.log` `e3b0c44298fc1c14…` | exit code only |
| source-lint | source | 2026-11-05T03:57:30 | 0 | log `source-lint.log` `e3b0c44298fc1c14…` | exit code only |
| source-contracts-check | source | 2026-11-05T03:57:34 | 0 | log `source-contracts-check.log` `3e8bf9225a03bd72…` | exit code only |
| source-referenced | source | 2026-11-05T03:57:34 | 0 | `source-referenced.json` `618d2cb7116de9f7…` | passed 186, failed 0, skipped 1, total 187 |
| source-unit | source | 2026-11-05T03:58:10 | 0 | `source-unit.json` `f19b93ad9b739daf…` | passed 48, failed 0, skipped 0, total 48 |
| source-contracts | source | 2026-11-05T03:58:12 | 0 | `source-contracts.json` `832378dcfa5c7f08…` | passed 37, failed 0, skipped 0, total 37 |
| source-build | source | 2026-11-05T03:58:13 | 0 | log `source-build.log` `e3b0c44298fc1c14…` | exit code only |
| source-adapters | source | 2026-11-05T03:58:32 | 0 | `source-adapters.json` `e3d91a4d92dc0e49…` | passed 50, failed 0, skipped 0, total 50 |
| source-integration | source | 2026-11-05T03:58:34 | 1 | `source-integration.json` `f509a15be0eb47e5…` | passed 588, failed 1, skipped 2, total 591 |
| source-pytest | source | 2026-11-05T04:01:05 | 0 | `source-pytest.xml` `bee6426b132c115e…` | tests 178, failures 0, errors 0, skipped 0 |
| lab-check-source | lab | 2026-11-05T04:01:06 | 0 | log `lab-check-source.log` `72e5c50dd635e6ff…` | exit code only |
| lab-typecheck | lab | 2026-11-05T04:01:06 | 0 | log `lab-typecheck.log` `e3b0c44298fc1c14…` | exit code only |
| lab-vitest | lab | 2026-11-05T04:01:08 | 0 | `lab-vitest.json` `1166a1340914cd5e…` | passed 100, failed 0, skipped 1, total 101 |
| lab-build | lab | 2026-11-05T04:01:10 | 0 | log `lab-build.log` `bf7ce9d8cf328508…` | exit code only |
| lab-e2e-ui | lab | 2026-11-05T04:01:12 | 0 | `lab-pw-ui.json` `928c23b0b3358c21…` | expected 13, unexpected 0, skipped 7, flaky 0 |
| lab-twin-e2e | lab | 2026-11-05T04:01:32 | 0 | `lab-pw-twin-twin-workspace.json` `208f76a3ca91fb73…`<br>`lab-pw-twin-coffee-journey.json` `9b81fe5bab7beca2…`<br>`lab-pw-twin-twin-recovery.json` `c4c8da26c9028a5e…` | expected 5, unexpected 0, skipped 0, flaky 0<br>expected 1, unexpected 0, skipped 0, flaky 0<br>expected 1, unexpected 0, skipped 0, flaky 0 |
| lab-mock-e2e | lab | 2026-11-05T04:01:58 | 0 | `lab-pw-mock-twin-recovery.json` `e77b70fa06657e9a…`<br>`lab-pw-mock-coffee-journey.json` `c1147147d6d82fe9…` | expected 1, unexpected 0, skipped 0, flaky 0<br>expected 1, unexpected 0, skipped 0, flaky 0 |
| lab-runtime-e2e | lab | 2026-11-05T04:02:17 | 0 | `lab-pw-runtime.json` `676096f77b49f738…` | expected 1, unexpected 0, skipped 0, flaky 0 |

**The source CI-equivalent gate did NOT fully pass.** `source-integration` exited 1, with 588 passed, **1 failed** and 2 skipped. The failing test is `upgrade-recovery.test.ts › backup verification finds corruption, missing segments, strays, missing objects and credentials in the Auth inventory` (`expected '' to match /corrupt public\.sql/`). Everything else in the CI order passed: contracts:check, typecheck, lint, build, unit 48, contracts 37, adapters 50, and pytest 178 (`robotics/agent/tests`, `tests/hardware`, `tests/contracts/test_schema_python.py`). No suite was not_run.

What I established about the failure:
- The test file and `scripts/backup-verify.mjs` / `scripts/backup-restore-lib.mjs` are byte-identical to base `e3b616a` (0-line diff), and this branch adds no code that touches Postgres.
- On HEAD the same test failed in 2 of 4 full-suite runs. It passed alone 3/3, and passed in the other 2 full runs (one of them instrumented).
- On base `e3b616a` (temporary worktree, same Supabase), the full integration suite passed 2/2 (469 passed).
- The test overwrites byte 100 of `public.sql` with `X`. Byte 100 lies inside pg_dump's random `\restrict` key, so the "corruption" is a no-op whenever that byte is already `X`. That would give exactly the observed `''`. But the frequency seen on HEAD is higher than 1/62, so **the cause is not proven**, and I cannot claim it is unrelated. It is recorded as an open finding and the test was not changed.

Other notes:
- `lab-e2e-ui` runs every spec. The 7 runtime specs skip there and are counted only from the twin, mock and runtime e2e files.
- The skips are the measurement-only tests gated on environment variables. `lab-runtime-artifact`'s `--clean-checkout` case ran with `LAB_V2_CLEAN_EXPORT=1` in `source-referenced`.

### Transport deny

The spies are attached before `POST /runs`. net.* calls are allowed only for the test client's loopback connections to the gateway port; http(s), dgram and child_process saw zero calls. Hardware sets are denied, and `nativeExecution:false`.

## 6. notMeasured / not run (carried from F06/F07)

| Item | Status | Reason |
|---|---|---|
| UI frame-time p95 | not_run `NOT_IMPLEMENTED` | No frame-time harness exists |
| Usability (3/5/2 min, ≥5 new users) | not_run `NEEDS_HUMAN` | Cannot be done by an agent; no users were simulated |
| Fresh macOS profile / network-off / cold boot | not_run `NEEDS_HUMAN` | F07. Warm boot-to-ready p95 is 608 ms, with no pass badge |
| Fresh Linux profile | not_run `BLOCKED_EXTERNAL` | No Linux host |
| Offline vendored bundle | not_run `NOT_IMPLEMENTED` | F07 |

## 7. Changes made for F08 and known limits

- **First round (`79d801e`, `76960de`):**
  - FD02–FD05 scenarios.
  - Plant faults (localization-lost, map-changed, dock-offset) and the hold log.
  - Coffee cancel.
  - `Coffee.StepTimeout` role fix.
- **Fix round 1 (`6477409`, `a741e01`):**
  - Transient coffee interlocks wait visibly instead of latching attention.
  - A suspended script hands pending confirmations to a person.
  - Per-row records and stored-result validation.
- **Final fix wave:**
  - **Source `74c463f`:** a `beverage` feature gates Coffee/Cup commands. RegisterRecipe, ReserveJob and StartJob are new work; the rest finish existing work. It depends on kitchen and inventory, is off in every preset, and is enabled by the Lab v2 fixture.
  - **Source `0608019`:** a failing `--clean-checkout` export now surfaces the git error and always removes its temp directory.
  - **Source `d473d87`:** the recovery test asserts that the recovered op is a committed `Robot.Observe`.
  - **Source `e152814`:** the guard checksums but does not parse the pytest junit result.
  - **Lab `9ad93c7`:** CSV formula neutralisation and in-string path redaction.
  - **Lab `67afbb8`:** a same-SHA re-import keeps the verified directory, and the rollback lock is written atomically after the lock.
  - **Lab `2943757`:** README runtime paragraph rewritten from the real values.
  - **Lab `0c91b1e`:** the recorder is committed.
  - **Lab `78c44bc`:** re-pin to `d473d87`.

Known limits:
- FD03 is a scheduled sequence of discrete obstacle steps, laid out for the fixture coordinates.
- FD07 serialises robots on the venue-wide zone.
- A run that raised attention stays `needs_attention`.
- Reclaim answers 501.
- The domain-level rows are not runner runs.
- One open integration finding (§5).

## 8. Gate state

| Gate | State |
|---|---|
| R-MOCK / G-MOCK | **Partially implemented and tested on this host. Not accepted.** Acceptance needs all of the following: (a) the mock-capable `NOT_IMPLEMENTED` rows implemented, or waived by the owner; (b) the `NEEDS_HUMAN` items done; (c) an owner's evidence review; (d) the open `upgrade-recovery` CI finding resolved |
| R-SIM, G-SIM-* | `blocked_external`: needs Linux with Gazebo/Nav2 and LinuxCNC (plans 02/03) |
| G-HW-READY | not started |
| G-HW-ACCEPT, G-VENUE | `blocked_external` |

G-MOCK blockers (the 18 `NOT_IMPLEMENTED` rows), each to implement or waive:
- **QA:** QA-02b, QA-09b.
- **Food and campaign:** FD02-cups, CAMPAIGN-FD02+FD07+BV01+BV03.
- **Coffee:** BV02-capacity, BV04-outlier, BV06-capacity, BV07-timeout, BV08-milk-policy.
- **Arm:** ARM03 (G-MOCK allows not_run without a checker; R-SIM requires one), ARM05.
- **System:** SYS01-render, SYS02-reclaim, SYS03-reorder.
- **UX:** UX-05-reset-speed, UX-18-speed.
- **Release:** R-MOCK-offline-bundle, UI-perf-p95.

`NEEDS_HUMAN`: UX-01-time, R-MOCK-fresh-macos, R-MOCK-network-off, R-MOCK-cold-boot. `BLOCKED_EXTERNAL`: R-MOCK-linux.

The freeze file is [`config/simulation-compatibility.json`](../../../../config/simulation-compatibility.json) (`R-MOCK: partially_implemented_tested_not_accepted`, `gMockBlockers`, pin and final head).
