# F08: R-MOCK acceptance report (mock evidence)

Status: **implemented and tested, not accepted.** An owner still has to review this evidence, and the `NEEDS_HUMAN` items below are still open. R-SIM and every hardware gate remain `blocked_external` or not started.

## 1. Baseline host and thresholds (fixed before the timing run)

This section was written and committed before the evidence run in §3. During development the checks also ran several times; those runs are not evidence.

| Item | Value |
|---|---|
| Host | Apple M2 Pro, 10 cores, 16 GiB RAM, macOS 26.5 (25F71), darwin arm64 |
| Toolchain | Node v24.22.2 (nvm, user-level), pnpm 10.32.1 |
| Source | branch `feat/lab-digital-twin-v2`. Artifact and final HEAD are both `76960de6f34a8aed544e283edfc65404193a77cd` |
| Lab | branch `feat/robot-lab`. Runtime pin commit `519f893` (artifact `70197e40e7fb2cc98f53a6dc80b2042a9b496276e95623fe40b3164a6cb5cbe4`, protocol 1/2) |
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

## 3. Evidence run

- Command (source `76960de`, clean, from `source/`):
  `LAB_V2_REQUIRE_LAB_FIXTURES=1 LAB_V2_MOCK_EVIDENCE=<lab>/docs/implementation/evidence/digital-twin-v2/F08-mock-acceptance.json pnpm test:acceptance -- tests/acceptance/lab-v2-mock.acceptance.test.ts`
- Start: 2026-11-05T03:01:46Z. Result: `Test Files 1 passed; Tests 40 passed`, duration 77.9 s.
- Machine-readable results: [`F08-mock-acceptance.json`](F08-mock-acceptance.json), sha256 `65bb614282988f1f8d919d02a21afc65e83d76ce62cad619c271a2e04f29f625`. It holds the rows, counts, the 20-seed digests, the repeat digests, failure traces of every fault check, and the timing values. All data is synthetic. A scan of the file found no absolute path, token or secret string.
- Every `self` row is a check in that file. It only counts as executed after all of its assertions ran: `passed` is recorded at the end of the check. The guard test fails if a `pass` row points at a check that did not pass, or at a source/lab test title that does not exist in its file. It also fails if a `not_run` row has no reason, or if any QA-01..12, FD01..08, BV01..08, ARM01..06, SYS01..06 or UX-01..20 ID is missing.

### Coverage counts (102 rows)

| Status | Rows |
|---|---:|
| pass | 77 |
| not_run `NOT_IMPLEMENTED` | 16 |
| not_run `UNSUPPORTED_FIDELITY` | 4 |
| not_run `NEEDS_HUMAN` | 4 |
| not_run `BLOCKED_EXTERNAL` | 1 |

The 77 pass rows break down by evidence source:

- **27 rows:** only checks executed in the acceptance file.
- **19 rows:** an acceptance check plus a referenced suite.
- **31 rows:** only referenced source or Lab suites, all executed green in §5 of this session. These are mostly UX/browser, model and domain-level rows.

By level: runner 42, browser 10, lab 7, model 7, domain 6, gateway 4, host 1. A `domain` or `model` row is real source code executed through `processCommand` or the model functions. It is **not** a runner run. That level is stated per row and must not be read as runner coverage.

### Coverage table

| ID | Level | Status | Executed check(s) | Expected / note |
|---|---|---|---|---|
| QA-01 | runner | pass | source:lab-v2-mock.acceptance.test.ts — coverage table: every pass row has an executed assertion<br>source:lab-v2-mock.test.ts — FD01: same seed and inputs give the same canonical outcome, … | every assertion row names its requirement, scenario revision, backend/model level, expected/actual and evidence refs |
| QA-02 | runner | pass | source:lab-v2-mock.test.ts — FD01: same seed and inputs give the same canonical outcome, …<br>acc: SYS01 runner: step granularity, pauses and interleaved reads never chang… | manifest holds project/world/scenario/source/backend/asset hashes, seed, PRNG and clock — *calibration/profile revisions: the mock has no calibration profile; nothing calibrated is claimed* |
| QA-03 | runner | pass | acc: QA-03 stochastic: FD01 and FD02 over 20 fixed seeds hold every invariant…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | same inputs/seed/source give the same normalized trace; 20 seeds for stochastic scenarios, 3 repeats per input |
| QA-04 | runner | pass | acc: SYS01 runner: step granularity, pauses and interleaved reads never chang… | the backend clock executes; step size, pauses and reads never change the domain result — *browser render rate / tab visibility not varied in a test: see SYS01-render* |
| QA-05 | runner | pass | acc: SYS03 runner: duplicate and stale retained completions are absorbed or r…<br>acc: BV05 runner: lost ACK, duplicate completion and a reboot mid-brew: one e…<br>acc: FD04 runner: lane closed while travelling: hold, then NO_PATH attention;…<br>acc: BV02 runner: no cup under the nozzle before start: the job never starts …<br>acc: SYS06 gateway: missing/wrong backend or identity is blocked with a reaso…<br>source:coffee-job.test.ts — reservation is atomic and resources are exclusive<br>source:lab-v2-arm-model.test.ts — joint limits are enforced: a target reachable only outside t… | negative cases exist and hold: stale, duplicate, missing ACK, no-path, invalid recipe/joints/cup, backend unavailable |
| QA-06 | gateway | pass | acc: QA-06 transport deny: a full coffee run through the gateway opens no rob…<br>source:lab-v2-stream.test.ts — reading the report and both streams is read-only: command co…<br>lab:report-replay.test.ts — replay is read-only: seek returns recorded events and the po… | report/replay/import/runs execute no robot/cell/arm/payment/print effect: checked at the transport boundary — *payment/print effects do not exist in the Lab runtime; spies cover net/http/https/dgram/child_process* |
| QA-07 | gateway | pass | acc: SYS06 gateway: missing/wrong backend or identity is blocked with a reaso…<br>source:lab-v2-mock.acceptance.test.ts — coverage table: every pass row has an executed assertion | missing backend/capability is blocked with a reason; no fallback; no skip-to-pass |
| QA-08 | runner | pass | source:lab-v2-report.test.ts — compareRuns: same scenario/mode/backends with another seed i…<br>source:lab-v2-report.test.ts — a KPI without data is unavailable with a reason, never 0<br>acc: Timing: two runs compare wait/travel/brew/transfer and interventions aga… | metrics carry unit, definition, population; missing data is unavailable, never 0 |
| QA-09a | lab | pass | lab:core-design-world.test.ts — edits coordinates immutably and invalidates old reports and …<br>lab:project-v2-migration.test.ts — an interruption mid-transaction leaves no half-save: backup,… | edits are immutable revisions; migration keeps the old record and rolls back on interruption |
| QA-09b | lab | not_run `NOT_IMPLEMENTED` | — | editing model/world/recipe/profile marks v2 run evidence stale by scope — *v2 runs lock their inputs (UX-16) but no scope-based staleness marking of stored v2 evidence exists yet* |
| QA-10 | model | pass | lab:twin-telemetry.test.ts — freshness: heartbeat alive does not refresh a pose that stop…<br>source:lab-v2-model.test.ts — transform convention T_A_B: golden world pose through cell_b…<br>source:lab-v2-arm-model.test.ts — source units convert to SI explicitly: inch->m and deg->rad,…<br>lab:twin-workspace.test.ts — inspector separates observed from commanded, keeps units and… | freshness, frames and units checked independently; commanded never stands in for observed |
| QA-11 | browser | pass | lab:twin-recovery.spec.ts — telemetry stream, stale/frozen states, reconnect, read-only …<br>lab:twin-workspace.spec.ts — WebGL disabled and reduced motion fall back to a 2D twin wit…<br>lab:ui.spec.ts — desktop workshop screenshot and WebGL context loss retain co… | WebGL loss, disconnect and reload never change command ownership or repeat an effect; history resumes by cursor |
| QA-12 | gateway | pass | acc: SYS06 gateway: missing/wrong backend or identity is blocked with a reaso…<br>acc: QA-06 transport deny: a full coffee run through the gateway opens no rob…<br>source:lab-v2-contracts.test.ts — evidence records only allow the four spec results<br>lab:core-deployment.test.ts — exports hashed inputs without promoting simulation into hard… | mock/simulation never promotes a hardware gate; hardware sets are denied in the Lab — *the hardware gate content itself (identity, calibration, owner signature) is H-only: blocked_external* |
| FD01 | runner | pass | acc: FD01 runner: arrival from observations, three legs, served only after ha…<br>acc: QA-03 stochastic: FD01 and FD02 over 20 fixed seeds hold every invariant… | 0 delivered before load/handoff; right allocation; arrival from observation; three traced legs; parks, never charges |
| FD02 | runner | pass | acc: FD02 runner: one batched mission for two tables; confirming table A hand…<br>acc: QA-03 stochastic: FD01 and FD02 over 20 fixed seeds hold every invariant… | confirming table A transfers only A; remaining stop and cargo correct |
| FD02-cups | runner | not_run `NOT_IMPLEMENTED` | — | food and coffee cups with their own ids mixed on one tray/mission — *coffee missions carry one cup each; a mixed food+coffee batch is not modelled by the runner (cup ids stay separate per BV01)* |
| FD03 | runner | pass | acc: FD03 runner: a scheduled pedestrian crosses the route; the robot waits/r…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | a person crossing the route: the robot waits/replans in the model, no penetration, resumes with a recorded cause — *person = scheduled 0.4 m obstacle stepping 0.2 m every 15 ticks; avoidance is the mock hold/replan rule on a geometric grid, not sensing* |
| FD03-sensor | runner | not_run `UNSUPPORTED_FIDELITY` | — | reaction to a sensed pedestrian (Nav2/sensor) — *mock_kinematic has no sensors or dynamics; S/H only (G-SIM-NAV blocked_external on this host)* |
| FD04-chair | runner | pass | acc: FD04 runner: chair on the destination: no false arrival, rejected with U… | chair on the target: no false arrival, attention with a reason, no teleport |
| FD04-blocked | runner | pass | acc: FD04 runner: lane closed while travelling: hold, then NO_PATH attention;… | lane fully closed: hold then NO_PATH attention, no arrival, no contact |
| FD04-reopen | runner | pass | acc: FD04 runner: lane reopened inside the hold window: the robot resumes by …<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | lane reopened: resume only by policy (inside the hold window), recorded hold and clear |
| FD05-payload | runner | pass | acc: FD05-payload runner: refused before any native start with OVERLOADED; no… | refused before native start with the right code; no stock change, nothing served |
| FD05-battery | runner | pass | acc: FD05-battery runner: refused before any native start with BATTERY_LOW; n… | refused before native start with the right code; no stock change, nothing served |
| FD05-capability | runner | pass | acc: FD05-capability runner: refused before any native start with CAPABILITY_… | refused before native start with the right code; no stock change, nothing served |
| FD05-binding | runner | pass | acc: FD05-binding runner: refused before any native start with TARGET_UNBOUND… | refused before native start with the right code; no stock change, nothing served |
| FD06-cancel | runner | pass | acc: FD06 runner: cancel while the robot holds the dish: return stop, staff c… | cancel while holding cargo: mission stops on evidence, cargo explicit, return + staff disposition, never delivered |
| FD06-retarget | domain | pass | source:table-order-amendments.test.ts — moving a table while the robot is en route retargets the mis… | retarget while en route: new revision, no stale leg — *domain level only: the Lab action schema has no retarget action, so no runner check* |
| FD07 | runner | pass | acc: FD07 runner: two robots, one narrow corridor: one owner at a time, no un…<br>source:lab-v2-recovery.test.ts — an expired command is never sent; the run needs attention in…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | one corridor owner by policy, no undetected deadlock, unknown not released by TTL — *the simulator profile serialises on the venue-wide movement zone; granular per-corridor zones are not enabled* |
| FD08-localization | runner | pass | acc: FD08 runner: localization lost before arrival: goal unknown, attention, … | localization lost before arrival: attention, last pose stale, no arrival |
| FD08-map | runner | pass | acc: FD08 runner: map revision changes at a stop: the next leg is refused (MA… | map revision change: next leg refused, pose stale, nothing served |
| FD08-rebind | domain | pass | source:robot-admission.test.ts — a robot reporting a new map mid-mission is held: confirmed c… | a new map needs a new binding before dispatch resumes — *domain level: the Lab runner has no map-report/rebind action* |
| BV01 | runner | pass | acc: BV01 runner: both recipes run their own step order; espresso has no ice/…<br>source:coffee-transfer.test.ts — BV01 on mock-default: espresso and iced milk coffee run reci…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | recipe steps of the locked revision; espresso without ice/milk; one cup owner; verified dose before pickup; right cup at the table |
| BV02-nocup | runner | pass | acc: BV02 runner: no cup under the nozzle before start: the job never starts … | no cup: never starts |
| BV02-removed | runner | pass | acc: BV02 runner: cup removed mid-brew: step fails CUP_REMOVED, job held, the… | cup removed mid-brew: interlock, partial/unknown explicit, never ready |
| BV02-type | domain | pass | source:coffee-job.test.ts — brew only after cup + machine ready, through station-scoped … | wrong cup type/id refused — *domain level (CUP_TYPE_MISMATCH, CUP_MISMATCH); no runner fault places a wrong cup* |
| BV02-capacity | domain | not_run `NOT_IMPLEMENTED` | — | cup capacity/headspace refused — *recipes and cups carry no capacity/headspace model yet* |
| BV03-milk | runner | pass | acc: BV03 runner: milk runs out: espresso still served, iced milk coffee held… | ingredient out: other order still served, held with reason, no blind retry |
| BV03-ice | runner | pass | acc: BV03 runner: ice dispenser jammed before its step: the dispense is refus…<br>acc: BV03 runner: ice dispenser jams mid-dispense: the partial amount is meas… | ice jam: partial kept, held, no second command |
| BV03-contention | runner | pass | acc: BV03 runner: two orders contend for one machine and arm: brews never ove…<br>source:coffee-job.test.ts — reservation is atomic and resources are exclusive | two orders on one machine/arm never share it against policy; robot pickup waits for the dock |
| BV04-tolerance | runner | pass | acc: BV04 runner: dose-low: the drink is not ready; requested, observed and a…<br>acc: BV04 runner: measure-unknown: the drink is not ready; requested, observe…<br>acc: BV04 runner: measure-missing: the drink is not ready; requested, observe…<br>source:coffee-job.test.ts — unknown or out-of-tolerance quantity cannot pass automatic q… | out of tolerance or unknown/missing measurement never becomes ready; requested/observed/accepted separate |
| BV04-timeout | runner | pass | acc: BV03 runner: ice dispenser jammed before its step: the dispense is refus…<br>source:coffee-job.test.ts — a silent device times out its step from the recipe timeout o… | step timeout on the recipe clock: attention, no resend |
| BV04-outlier | runner | not_run `NOT_IMPLEMENTED` | — | sensor outlier rejected by a plausibility rule — *no outlier fault or plausibility filter in mock_process* |
| BV05 | runner | pass | acc: BV05 runner: lost ACK, duplicate completion and a reboot mid-brew: one e…<br>source:coffee-recovery.test.ts — BV05 on mock-default: a cell reboot mid-brew leaves the outc… | lost ACK / reboot / duplicate id: one effect or unknown + reconcile; no second brew; lifecycle not reset |
| BV06-order | domain | pass | source:coffee-job.test.ts — recipe order is enforced; ice jam halts the workflow; empty …<br>source:coffee-job.test.ts — reservation is atomic and resources are exclusive<br>source:coffee-job.test.ts — a device observation counts only for its own step: another b… | wrong step order, recipe/item or hash mismatch refused before the step — *domain level: the runner always submits the locked recipe, so no runner fault produces a mismatch* |
| BV06-capacity | domain | not_run `NOT_IMPLEMENTED` | — | capacity/headspace overflow refused — *no capacity/headspace model (same gap as BV02-capacity)* |
| BV07-drop | runner | pass | acc: BV07 runner: arm drops the cup during pick: transfer fails, the cup is n… | arm/robot never co-own a cup; robot not released without the right cup |
| BV07-dock | runner | pass | acc: BV07 runner: robot docked out of tolerance: no tray transfer, the cup st… | dock out of tolerance: no tray transfer, robot held |
| BV07-cancel | runner | pass | acc: BV07 runner: cancel mid-cycle: the job is cancelled or held with a reaso… | cancel mid-cycle: disposition for the cup, nothing delivered |
| BV07-timeout | runner | not_run `NOT_IMPLEMENTED` | — | pickup timeout policy — *no pickup/handoff timeout exists in the coffee driver or domain; the robot waits indefinitely (held, never released)* |
| BV08-ready | runner | pass | acc: BV08 runner: machine not ready blocks the cup check/start with a reason;… | machine not ready blocks the step; only renewed readiness opens it |
| BV08-cleaning | domain | pass | source:coffee-recovery.test.ts — cleaning overdue and stale interlocks block the cell with a … | cleaning overdue / stale interlock blocks with a reason until an audited cleaning |
| BV08-milk-policy | domain | not_run `NOT_IMPLEMENTED` | — | milk batch/open-time/cold-handling policy and no interlock bypass after reboot — *no milk batch/open-time/cold-handling metadata in recipes or devices; mock reboot keeps device status, so the reboot case is not exercised* |
| CAMPAIGN-FD02+FD07+BV01+BV03 | runner | not_run `NOT_IMPLEMENTED` | — | food and coffee concurrently in one versioned workload; queue/travel/human wait/cell busy measured — *no combined food+coffee scenario definition; each part runs and is measured separately* |
| ARM01 | model | pass | source:lab-v2-arm-model.test.ts — FK agrees with the independent Craig oracle at 200 seeded co…<br>source:lab-v2-arm-model.test.ts — IK from a nearby seed converges inside the fixture tolerance…<br>acc: BV01 runner: both recipes run their own step order; espresso has no ice/… | FK independent oracle, seeded IK within tolerance, units/frames; runner arm trace within limits |
| ARM02 | model | pass | source:lab-v2-arm-model.test.ts — IK rejects unreachable targets with a structured result, not…<br>source:lab-v2-arm-model.test.ts — joint limits are enforced: a target reachable only outside t…<br>source:lab-v2-arm-model.test.ts — FK refuses wrong joint vectors and source-unit models | out of workspace / joint limit / invalid configuration refused, never clipped |
| ARM03 | model | not_run `NOT_IMPLEMENTED` | — | swept-volume collision of links/gripper/held cup, between samples — *no geometric collision checker exists (report coverage armCollisionChecker:false); G-MOCK allows PASS only with a checker* |
| ARM04 | model | pass | source:lab-v2-arm-model.test.ts — near-singular wrist (J5 -> 0, LinuxCNC JOINT_4) is rejected …<br>source:lab-v2-arm-model.test.ts — IK keeps branch continuity along a path and selects the wris…<br>source:lab-v2-arm-model.test.ts — velocity limit rejects a step the joints cannot make in the … | near singularity / branch change / velocity limit: continuity kept or refused — *acceleration limits are not modelled* |
| ARM05 | model | not_run `NOT_IMPLEMENTED` | — | following error / stop / E-stop then reset without auto-resume — *mock_arm has no following-error or stop model; G-MOCK does not list ARM05* |
| ARM06 | runner | pass | acc: ARM06 runner: arm reboot after an accepted pick: transfer outcome unknow…<br>source:coffee-transfer.test.ts — arm outcome unknown during transfer holds the cup with its l… | link loss / reboot after accept: no blind resend; unknown holds cup ownership until reconcile |
| SYS01 | runner | pass | acc: SYS01 runner: step granularity, pauses and interleaved reads never chang…<br>acc: QA-03 deterministic scenarios: FD07, BV01, FD03, FD04-reopen repeat 3 ti… | same inputs: same normalized trace regardless of step size/pauses; manifest names the backend set |
| SYS01-render | browser | not_run `NOT_IMPLEMENTED` | — | 15/60 FPS render and a background tab leave the trace unchanged — *no browser test varies render rate or tab visibility; the UI is not a clock source by construction (runtime ticks only on step actions)* |
| SYS02-executor | runner | pass | acc: SYS02 runner: executor crash after a committed accept: reopen holds unkn…<br>source:lab-v2-recovery.test.ts — crash after journal commit and before checkpoint reopens as … | executor crash after accept: no owner change, no duplicate effect, unknown vs stale explicit |
| SYS02-ui | browser | pass | lab:twin-recovery.spec.ts — telemetry stream, stale/frozen states, reconnect, read-only … | UI/gateway loss and reconnect: no duplicate action, lost session explicit |
| SYS02-reclaim | gateway | not_run `NOT_IMPLEMENTED` | — | reclaim of a run by a new session/runtime — *POST /runs/:id/reclaim answers 501; a restarted runtime needs re-pairing and a new run* |
| SYS03 | runner | pass | acc: SYS03 runner: duplicate and stale retained completions are absorbed or r…<br>acc: BV05 runner: lost ACK, duplicate completion and a reboot mid-brew: one e… | duplicate / stale retained completions never revive a terminal state or count twice |
| SYS03-reorder | runner | not_run `NOT_IMPLEMENTED` | — | reordered/delayed observations — *no reorder/delay fault in the plant adapters (duplicate/stale only)* |
| SYS04 | lab | pass | lab:core-design-world.test.ts — rejects unknown fields, nonfinite numbers and unsupported im…<br>lab:project-store.test.ts — rejects corrupt imports before overwriting a saved project<br>source:lab-v2-recovery.test.ts — clean close and reopen resumes from the checkpoint with the … | geometry edit is a new revision; bad/old import refused without damage; saved run reopens with its locked inputs — *scope-based staleness of old v2 reports: see QA-09b* |
| SYS05 | runner | pass | acc: SYS05 runner: reading the report and journal repeatedly is read-only (jo…<br>acc: QA-06 transport deny: a full coffee run through the gateway opens no rob…<br>lab:report-replay.test.ts — replay is read-only: seek returns recorded events and the po…<br>lab:core-deployment.test.ts — rejects live state, credentials and forged validation in can… | replay/scrub/export/import cause no effect; action-like fields inert or refused |
| SYS06 | gateway | pass | acc: SYS06 gateway: missing/wrong backend or identity is blocked with a reaso…<br>acc: BV05 runner: lost ACK, duplicate completion and a reboot mid-brew: one e…<br>acc: FD08 runner: localization lost before arrival: goal unknown, attention, … | backend missing/wrong version/mode change: blocked with reason, no fallback; backend death mid-run held unknown |
| UX-01 | browser | pass | lab:twin-workspace.spec.ts — coffee preset runs on the mock backend with a locked, visibl…<br>lab:mock-launcher.test.ts — missing runtime says preview only and how to install; never … | sample project with food and coffee runs through the source runner; missing runner is explained, never completed |
| UX-01-time | human | not_run `NEEDS_HUMAN` | — | start mock within 3 min, complete/report within 5 min, find a fault cause within 2 min (>=5 new users) — *guided usability with representative users cannot be performed by an agent* |
| UX-02 | browser | pass | lab:twin-workspace.spec.ts — layers, legend and one shared selection survive a 3D to 2D s… | 2D/3D of the same run keeps run id, time, selection; no domain action |
| UX-03 | lab | pass | lab:twin-workspace.test.ts — layers toggle overlays and the legend names modeled, observe…<br>lab:twin-workspace.spec.ts — layers, legend and one shared selection survive a 3D to 2D s… | route, target, footprint, occupancy layers with a legend; unknown stays unknown |
| UX-04 | browser | pass | lab:coffee-journey.spec.ts — missing cup: visible reason and entity, confirmed reconcile,…<br>lab:service-journey.spec.ts — paired source runtime drives arrival then human load and han… | mission/cargo/cup/arm state side by side; confirmation names the object |
| UX-05 | browser | pass | lab:twin-recovery.spec.ts — telemetry stream, stale/frozen states, reconnect, read-only …<br>lab:coffee-journey.spec.ts — missing cup: visible reason and entity, confirmed reconcile,… | run/pause/step by capability; pause is not stop — *reset and speed control are not offered for v2 runs (a new run is created instead)* |
| UX-06 | browser | pass | lab:coffee-journey.spec.ts — missing cup: visible reason and entity, confirmed reconcile,… | fault palette shows where/when a fault applied — *one-shot faults from the UI; schedules exist only as server scenario data (FD03/FD04)* |
| UX-07 | browser | pass | lab:twin-workspace.test.ts — inspector separates observed from commanded, keeps units and…<br>lab:twin-workspace.spec.ts — engineering panel shows units, observed versus commanded and… | inspector values with units, source and freshness; unknown never 0 |
| UX-08 | lab | pass | lab:report-replay.test.ts — trace links command -> observation -> business transition fo… | timeline links business events, commands and observations — *the 2-minute find-the-cause target is UX-01-time (NEEDS_HUMAN)* |
| UX-09 | lab | pass | lab:report-replay.test.ts — replay is read-only: seek returns recorded events and the po…<br>lab:report-replay.test.ts — pose interpolation only inside the declared max gap and neve…<br>acc: QA-06 transport deny: a full coffee run through the gateway opens no rob… | replay: recorded time/cursor, no execute, gaps marked, no interpolation over the gap |
| UX-10 | lab | pass | lab:report-replay.test.ts — compareRuns: comparable for same scenario/mode/backends; nev…<br>source:lab-v2-report.test.ts — compareRuns refuses to rank mock against hardware, and diffe… | compare shows inputs/coverage/samples; never ranks mock against hardware; missing KPI unavailable |
| UX-11 | browser | pass | lab:twin-workspace.spec.ts — mobile layout is operable with the keyboard only<br>lab:twin-workspace.spec.ts — WebGL disabled and reduced motion fall back to a 2D twin wit…<br>lab:ui.spec.ts — mobile and reduced-motion fallback remain accessible without… | responsive, keyboard, reduced motion, 2D when WebGL is missing; no run lost on context loss |
| UX-12 | lab | pass | lab:project-store.test.ts — rejects corrupt imports before overwriting a saved project<br>lab:ui.spec.ts — failed huge numeric import keeps the usable current and pers… | save/open/import/export with migration and revision; history unchanged — *old-run badge against the current configuration: QA-09b* |
| UX-13 | model | pass | source:lab-v2-model.test.ts — compileAsset derives visual and collision from one geometry …<br>lab:project-v2-migration.test.ts — the catalog fixture, the compiled footprint and the viewer s… | one asset/world revision for scene, planner and collision |
| UX-14 | model | pass | source:lab-v2-contracts.test.ts — twin sample states are finite per entity kind, SI units in t…<br>lab:twin-telemetry.test.ts — orders samples per provider by bootId+seq: a late older samp… | state samples carry entity, frame, SI unit, sim/wall time, source and sequence |
| UX-15 | domain | pass | source:coffee-transfer.test.ts — cell -> arm needs grasp evidence from the bound arm observer…<br>lab:twin-workspace.test.ts — inspector separates observed from commanded, keeps units and…<br>acc: FD01 runner: arrival from observations, three legs, served only after ha… | desired/commanded, observed and derived stay separate (goal != arrived, dispense != dose, gripper closed != holding) |
| UX-16 | runner | pass | source:lab-v2-recovery.test.ts — clean close and reopen resumes from the checkpoint with the …<br>lab:twin-workspace.test.ts — locked identity shows recipe and project revisions as the ru… | a run locks project/scenario/source/backend set; edits never change a running run |
| UX-17 | runner | pass | source:lab-v2-stream.test.ts — telemetry is a separate coalesced stream of schema-valid sam…<br>lab:twin-telemetry.test.ts — freshness: heartbeat alive does not refresh a pose that stop…<br>lab:twin-recovery.spec.ts — telemetry stream, stale/frozen states, reconnect, read-only … | continuous telemetry with stale/drop/disconnect marks; heartbeat on a monotonic clock |
| UX-18 | runner | pass | acc: FD04 runner: chair on the destination: no false arrival, rejected with U…<br>acc: FD05-payload runner: refused before any native start with OVERLOADED; no…<br>acc: BV01 runner: both recipes run their own step order; espresso has no ice/… | geometry/load/recipe changes act on the model with an explainable effect — *speed-limit changes: see UX-18-speed* |
| UX-18-speed | runner | not_run `NOT_IMPLEMENTED` | — | a speed-limit change acts on the model — *mock_amr speed is a fixed illustrative 0.5 m/s; scenario speed limits are not wired into the plant* |
| UX-19 | runner | pass | source:lab-v2-report.test.ts — report separates durable business events from lossy coalesce…<br>acc: QA-06 transport deny: a full coffee run through the gateway opens no rob… | the report says which engine/model backs each claim; mock never claims physics |
| UX-20 | model | pass | source:lab-v2-contracts.test.ts — coffee recipes use exact decimal strings and never allow aut…<br>lab:ui.spec.ts — all three locales fit tablet and desktop, with explicit unme… | measurement/calibration provenance; mock values labelled illustrative/assumed |
| R-MOCK-launcher | host | pass | lab:mock-launcher.test.ts — ready launcher prints the one-use code (never in a URL), mak…<br>lab:mock-launcher.test.ts — a non-mock backend enabled by the runtime is refused | single launcher starts the pinned runtime, refuses non-mock/unavailable backends, makes no outbound connection |
| S01 | browser | pass | lab:service-journey.spec.ts — paired source runtime drives arrival then human load and han… | S01 regression still runs through source domain/journal/dispatcher on the pinned artifact |
| R-MOCK-fresh-macos | host | not_run `NEEDS_HUMAN` | — | fresh macOS user profile install + first run — *needs a separate clean user profile on this machine (F07 not_run)* |
| R-MOCK-linux | host | not_run `BLOCKED_EXTERNAL` | — | fresh Linux profile install + first run — *no Linux host available (F07 not_run)* |
| R-MOCK-network-off | host | not_run `NEEDS_HUMAN` | — | launcher and run with networking disabled — *turning off host networking is outside agent scope (F07 not_run); the transport-deny check (QA-06) covers the runtime side* |
| R-MOCK-offline-bundle | host | not_run `NOT_IMPLEMENTED` | — | offline vendored dependency bundle install — *no vendored offline bundle exists (F07 not_run)* |
| R-MOCK-cold-boot | host | not_run `NEEDS_HUMAN` | — | boot-to-ready after a host reboot — *requires rebooting the host (F07 not_run; warm p95 608 ms recorded without a pass badge)* |
| UI-perf-p95 | browser | not_run `NOT_IMPLEMENTED` | — | p95 frame <= 33 ms desktop / <= 50 ms tablet 2D for 2 robots + 1 arm + 6 tables over >= 60 s — *no frame-time capture harness; F06 measured telemetry latency and heap only* |
| PHYS-grip-spill-stop | runner | not_run `UNSUPPORTED_FIDELITY` | — | cup grip, grasp force, spill, stop distance — *mock proves no physics (report coverage physicalGrip/armTorque/fluidModel/physicalStop false)* |
| PHYS-liquid | runner | not_run `UNSUPPORTED_FIDELITY` | — | real coffee/milk/ice quantities and brew state — *process model + synthetic measurements only (provenance modelled)* |
| PHYS-contact-dynamics | runner | not_run `UNSUPPORTED_FIDELITY` | — | contact/dynamics of robot motion — *mock_kinematic: no dynamics; contacts are geometric overlaps in the model* |

## 4. Stochastic seeds, repeats and timing (measured)

- **FD01 and FD02, 20 fixed seeds (1000–1019):** these scenarios draw order ticks from `atTick` ranges, so the seeds are real perturbations. All 40 runs were `completed`. FD01 served 1 and FD02 served 3 each time. Every run had 0 contacts, 0 rejected observations and exactly one confirmed attempt per `robot.execute`, and load always preceded handoff. Each scenario produced 20 distinct canonical digests out of 20 runs.
- **Same-seed repeats, 3× each:** FD01@1000 → `b3f4cb44…6890`; FD02@1000 → `adbc6d52…620c` (each equal to its seed-run digest).
- **Deterministic scenarios (seed is provenance only), 3× each:** FD07@77 `b31f1ab0…6419`, BV01@77 `006a6c82…1a3c`, FD03@77 `13afb2fe…95d0`, FD04-reopen@77 `c61f5019…3b13`. A run with seed 78 differs from seed 77 only in the manifest seed. These are not counted as 20 perturbations.
- **Failure traces:** 32 traces in the JSON (`evidence.traces`), one per fault check, with digest, attention, faults, rejected observations, reconciliations, holds and collision metrics.

### Timing comparison

Host and thresholds are as in §1. All durations are sim time in ms on the virtual clock.

| Run | wall ms | travel per leg | guest wait (line created → served) | brew | dispense (ice, milk) | ready → tray | staff wait at stops | interventions (human / scripted confirmations, reconciliations, attention) |
|---|---:|---|---|---|---|---|---:|---|
| BV01 seed 11 #1 | 1446 | 4560, 5660, 10220, 4560, 5660, 10220 | 47460, 84660 | 25500, 25500 | 3500, 4500 | 12260, 12260 | 17360 | 0 / 2, 0, 0 |
| BV01 seed 11 #2 | 1459 | identical | identical | identical | identical | identical | 17360 | 0 / 2, 0, 0 |
| FD01 seed 11 | 65 | 11640, 14000, 4080 | 27640 | n/a (no coffee) | n/a | n/a | 2000 | 0 / 2, 0, 0 |
| FD01 seed 12 | 60 | 11640, 14000, 4080 | 27640 | n/a | n/a | n/a | 2000 | 0 / 2, 0, 0 |

- **Same-input delta:** 0 ms for every duration and identical intervention counts, which meets `sameInputDeltaMs = 0`. Wall times are below the 30 s and 10 s budgets.
- **FD01 seed 11 vs seed 12:** the seed shifts only *when* the order is placed. Leg durations and waits measured from issue/arrival are therefore identical. `compareRuns` reports every KPI delta as 0: missionTimeS 31.72, humanWaitS 2, distanceM 14.84, executeAttempts 3, contacts 0, minSeparationM 0.018.
- **No missing or censored durations** in these four runs. "n/a" marks durations that do not apply, never 0.
- These are mock-model durations (illustrative 0.5 m/s AMR, 30 ml in 25 s brew). **They are not a physical cycle-time baseline**, and neither is the old 1000 ms simulator completion.

## 5. Regression run (this session, Node 24.22.2)

| Repo | Command | Result |
|---|---|---|
| source | `pnpm typecheck`, `pnpm lint`, `pnpm contracts:check` | ok, clean, "Contract generation matches schema." |
| source | vitest, 15 Lab/coffee files: `lab-v2-{mock,recovery,contracts,model,arm-model,stream,report,residuals}`, `lab-runtime{,-gateway,-contracts,-artifact}`, `coffee-{job,transfer,recovery}` (with `LAB_V2_REQUIRE_LAB_FIXTURES=1`) | 15 files; 141 passed, 1 skipped. The skip is the pre-existing `LAB_V2_MEASURE`-gated latency measurement |
| source | `robot-admission`, `table-order-amendments` (referenced domain rows) | 41 passed |
| source | `pnpm test:unit`, `pnpm test:contracts` | 48 passed, 37 passed |
| source | acceptance (§3) | 40 passed |
| lab | `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build` | ok; 63 passed; 35 passed + 1 skipped (the pre-existing `LAB_TWIN_MEASURE`-gated measurement); build ok |
| lab | `pnpm test:e2e -- ui.spec.ts` | 13 passed (the 12 ui.spec tests plus twin-workspace WebGL fallback). The 7 runtime-dependent specs skip without a token; **a skip is not a pass**, and those specs ran in the next three rows |
| lab | `pnpm test:twin-e2e` | twin-workspace 5/5, coffee-journey 1/1, twin-recovery 1/1 (pinned runtime `76960de`) |
| lab | `pnpm test:mock-e2e` | coffee-journey 1/1 through `pnpm lab:mock` |
| lab | `pnpm test:runtime-e2e` | S01 `service-journey` 1/1 on the pinned artifact |

### Transport deny

The check `QA-06 transport deny` runs a full BV01 coffee run through the real v2 gateway: pairing, run creation, start and steps until completed. During the run, spies sit on `net.Socket.prototype.connect`, `net.connect`, `net.createConnection`, `http.request/get`, `https.request/get`, `dgram.createSocket` and `child_process.spawn/exec/execFile/fork/spawnSync/execSync`.

Result: no spy was called by the runtime. The only `Socket.connect` calls were the test client's loopback calls to the gateway port. The gateway itself denies `hardware-live`, `hardware-hil` and `hardware-shadow` (403/422) and `simulation-default` (422 `BACKEND_NOT_INSTALLED`), and the run report says `nativeExecution:false`. This is a boundary test, not hidden UI.

## 6. notMeasured / not run (carried from F06/F07 evidence, still open)

| Item | Status | Reason |
|---|---|---|
| UI frame-time p95 (≤33 ms desktop, ≤50 ms tablet 2D, ≥60 s capture) | not_run `NOT_IMPLEMENTED` | No frame-time harness exists. F06 measured telemetry latency (p50/p95 FD07 2.1/49.6 ms, BV01 5.5/43.1 ms), TwinStore apply p95 of 8.7 µs and a Chrome heap of 15 MiB, not frames |
| Usability: start ≤3 min, complete/report ≤5 min, find cause ≤2 min, ≥5 new users | not_run `NEEDS_HUMAN` | An agent cannot run guided sessions with representative users; no users were simulated |
| Fresh macOS profile install | not_run `NEEDS_HUMAN` | F07 |
| Fresh Linux profile | not_run `BLOCKED_EXTERNAL` | No Linux host |
| Network-off launcher run | not_run `NEEDS_HUMAN` | F07; the runtime side is covered by the transport-deny check |
| Offline vendored bundle | not_run `NOT_IMPLEMENTED` | F07 |
| Cold boot after host reboot | not_run `NEEDS_HUMAN` | F07; warm boot-to-ready p95 608 ms over 10 starts, recorded without a pass badge |

## 7. Changes made for F08 and known limits

These source changes are in the runtime bundle and re-pinned (`79d801e` feat, `76960de` test; lab pin `519f893`).

- **New server scenarios (declarative data):**
  - FD02 (batched mission).
  - FD03 (a scheduled person: 12 discrete 0.4 m obstacle steps, 0.2 m every 15 ticks).
  - FD04 (chair on the target), FD04-blocked and FD04-reopen (corridor gap closed at tick 400, reopened at 590).
  - FD05-payload, FD05-battery, FD05-capability and FD05-binding (scenario `fleet`, `loadMinor` and `requestRobot` admission inputs).
- **New plant faults:**
  - `localization-lost`: the running goal becomes unknown and the pose goes stale.
  - `map-changed`: the robot reports another map, the adapter refuses old-map legs with a `rejected MAP_MISMATCH` observation, and the pose goes stale.
  - `dock-offset`: 0.2 m, illustrative.
- **Hold log:** plant hold transitions now appear in `report.metrics.holds`.
- **Runner and coffee fixes:**
  - Run cancel now reaches coffee jobs and missions.
  - A suspended script (cancel, recovery or a rejected input) leaves load/handoff/return confirmations to a person; before, they waited forever.
  - A coffee step refused by an interlock now holds the job with the domain code (`COFFEE_STEP_BLOCKED` + e.g. `INGREDIENT_EMPTY`) instead of retrying every tick without telling anyone.
- **F04 bug found by acceptance:** the Lab barista role could not submit `Coffee.StepTimeout`, so a timed-out step threw `COMMAND_NOT_ALLOWED` and interrupted the action. The fix adds it to the role.

Known limits:

- **FD03 avoidance** is the mock hold/replan rule against scheduled geometry. It is not sensing, and a person stepping onto the robot in the model is a contact. The schedule was tuned so the person crosses ahead of the robot.
- **FD03/FD04 obstacle coordinates** belong to the restaurant/corridor fixture layouts.
- **FD07** serialises robots on the venue-wide movement zone; granular zones are not enabled.
- **A run that raised attention stays `needs_attention`** (F03 latch). Mock reconcile is audit-only, so recovery means a new run.
- **SYS02 reclaim** answers 501.
- **No runner action** exists for retarget or rebind; those rows are domain level.
- **BV06 and BV02-type** are domain level: the runner always submits the locked recipe and the right cup.
- **The not_run rows** in §3 list the remaining gaps: capacity/headspace, pickup timeout, milk batch/cold-handling policy, sensor outlier, reordered/delayed observations, render-rate browser test, speed-limit wiring, ARM03 collision checker, ARM05 stop model, and the combined food+coffee campaign.

## 8. Gate state

| Gate | State |
|---|---|
| R-MOCK / G-MOCK | **implemented + tested on this host. Not accepted.** Acceptance needs an owner's evidence review and closure, or an explicit waiver, of the `NEEDS_HUMAN` items. ARM03 has no checker, so it stays not_run as G-MOCK requires |
| R-SIM, G-SIM-NAV, G-SIM-ARM, G-SIM-E2E | `blocked_external`: needs Linux with Gazebo/Nav2 and LinuxCNC (plans 02/03); not started on this macOS host |
| G-HW-READY | not started |
| G-HW-ACCEPT, G-VENUE | `blocked_external`: no devices |

The frozen interfaces for plans 02/03 are in [`config/simulation-compatibility.json`](../../../../config/simulation-compatibility.json).
