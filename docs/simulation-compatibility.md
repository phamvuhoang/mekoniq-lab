# Simulation compatibility and evidence scope

Updated 2026-11-05 for the Plan 01 software remediation and the Plan 02 simulation layer (section below). This page describes implemented interfaces and their limits. The Plan 01 regression/acceptance record is complete for source `c1d1ea70e42937d421070674f07d00edc7c41245`; the current Lab pin is `0101d6cfd0fa876eee235077bd591b313c05be37`. Owner acceptance and external gates remain open in the [remediation record](reviews/2026-11-05-plan-01-remediation.md).

## Authoritative records

- [`config/source-runtime.lock.json`](../config/source-runtime.lock.json) identifies the runtime Lab actually loads: source commit, schema hash, artifact hash and protocol majors.
- [`config/simulation-compatibility.json`](../config/simulation-compatibility.json) binds the current source/pin, provider revision 2, scenario/recipe and fixture hashes and final evidence (including the arm profile embedded in the hashed fixture). It records zero `NOT_IMPLEMENTED` rows and keeps owner/human/Linux/physical gates separate.
- Each run manifest locks its input project, world, assets, recipes, configuration, model, adapter and profile identities. Calibration is explicitly `not_calibrated` for these illustrative mock models.
- The [mock acceptance report](implementation/evidence/digital-twin-v2/mock-report.md) records executed checks and unresolved gates at its own revision. The [original review](reviews/2026-11-05-plan-01-code-review.md) remains historical; remediation does not rewrite it.

## Runtime and provider boundary

Lab requires Node 24. Protocol 1 retains S01; protocol 2 supplies the digital twin. `mock-amr` enables the AMR model, while `mock-default` includes `mock_amr`, `mock_arm` and `mock_coffee`. Listed future backend capabilities do not mean those providers are enabled or accepted.

Source owns domain decisions, journal, dispatcher, mission confirmations, inventory and cup custody. The browser renders snapshots and observations. Telemetry is lossy/coalesced; publication sequence is independent of simulation tick, and `simTimeNs` locates samples on the timeline. Reconnect uses the relevant stream cursor. Heartbeats do not refresh an old pose, and authorization expiry closes an open stream.

Plans 02/03 must verify the actual exported schema/provider hashes when binding a provider. Contract changes require a version/migration decision and fresh evidence. Mock durations and the old S01 completion timing are not physical cycle-time baselines. `simulation`, `shadow`, `hil` and `live` remain distinct evidence scales; reports do not rank unlike scales as equivalent performance runs.

The remediation changes the cell-adapter contract; its compatibility label moves from `lab-v2-provider/1` to `lab-v2-provider/2`. Providers must adopt the current contract and regenerate their binding evidence. The machine-readable snapshot records the new hashes from the clean export; earlier hashes remain historical.

## Recovery and input identity

Reset creates a new immutable run from locked inputs and preserves the prior report/journal. Wall-clock run speed changes request pacing; the mock clock retains its fixed 20 ms step. AMR speed limits are explicit project inputs and constrain mission admission and modeled motion for a new run.

Reclaim requires fresh pairing, CSRF and the original local proof. The proof is outside report/project exports. The source response returns the stored input, not a caller replacement; Lab validates it and preserves its project and seed for scene, evidence and reset. Missing inputs disable those dependent actions.

A reclaimed run is fenced to view/reconcile at both gateway and persisted runtime layers. Active robot missions carry explicit reconciliation identities, including robots waiting at a completed load/handoff navigation stop. Lab requires target selection when several known robots/jobs can be reconciled. Reconciliation records the native/mock answer; it does not restart motion, resend an uncertain effect, clear attention or confirm cargo. Creating a separate run is a separate action.

## Arm geometry claims

The mock arm uses illustrative PUMA kinematics and capsule geometry for links, gripper and held cup. Its adaptive sweep rejects unresolved intervals conservatively. It has no torque, grip-force, fluid, spill or physical stopping model.

Project-scene coverage requires a valid, versioned `armCollisionProfile`: SI base pose in the map, normalized quaternion, matching model identity/revision, declared fixture/robot heights and illustrative provenance. Project rectangles become conservative arm-frame AABBs; AMR envelopes use compiled footprint radii and modeled previous/current poses. Checks also run between arm programs, including while holding a cup. Conservative bounds may reject motion that more detailed geometry would permit.

Legacy projects without a profile report `self_injected_only`. Missing geometry or pose cannot establish scene clearance. The manifest locks the exact profile/world/robot geometry, while the report distinguishes executed checker coverage, scene coverage and trace completeness. Collision intervals are bounded; dropped intervals disclose incomplete history, and the first blocked interval retains its own geometry/attachment snapshot. Replay exposes only evidence available by its cursor. These claims require the declared profile and model; they do not imply calibrated alignment, measured meshes, hardware clearance or full R-SIM acceptance.

## Replay and metrics

Replay reconstructs time-specific job, cup owner, measurements, served quantity and arm state from recorded events/samples. It filters plant process logs and collision evidence by time. Cumulative values unavailable at an earlier cursor remain unavailable. Saved evidence is immutable, and edits mark affected model/world/recipe/profile scopes stale.

Human wait is correlated by mission/stop and ends on the final allocation confirmation; incomplete/cancelled stops are excluded. Coffee queue wait, completed travel and cell-process busy time have separate definitions and populations. Cell busy time unions completed accepted-to-completed intervals; an active incomplete cycle is unavailable. Inter-robot separation needs at least two robots and excludes wall clearance. One run per side provides no p50/p95 population claim.

## Plan 02 simulation layer

Updated 2026-11-05 for Plan 02. Source `0101d6cfd0fa876eee235077bd591b313c05be37` (plan 02 plus its review fix pass) adds the simulation layer; the Lab pin moved to artifact `f96a65b36bd3520bb04a4282314bdf55867b1257e591271c28f0bf7d948257ec` (schema hash `f112425e636254a6c3d20d75d615b696c426c7d2a5fb185c01a1943095fe0ffd`). The export manifest now records the digest of the separately distributed Linux SIL tools; they are not part of `runtime.mjs`, and importing or starting the mock never needs Gazebo.

- **Backends.** `gazebo_nav2` has an orchestrator and worker bridge; its evidence is `sil` only with a real worker on a Linux host, protocol doubles are business evidence. `coffee_io_sim` is the F04 process model behind the simulation backend id with modelled measurements and no fluid or thermal model. `linuxcnc_sim` is not implemented (plan 03); the beverage plant session couples the mock arm as `open_loop_visualization`, never closed-loop. The backend set `coffee-simulation` names all three; a missing one is `BACKEND_MISSING`, never a fallback.
- **Admission and support.** The scenario matrix (`source/packages/lab-runtime/src/v2/scenario-matrix.ts`) binds every verification id to requirement refs, fixtures, tests, backend support, an oracle, invariants and measurements; hardware support is false for every row in this runtime. The Lab reads what a campaign can run from the runtime's health answer (`src/scenarios/support.ts`, `fixtures/scenarios/food-beverage-campaign.json`); it never hardcodes availability.
- **Evidence.** `LabEvidenceV2` records separate a business record (journal-backed invariants, evaluated in every mode) from a physics record that stays `not_run` without a real SIL worker and an arm-closed-loop record that stays `not_run` while the coupling is open-loop. Modelled quantities never carry `measured` provenance; cup movements must trace to a command or evidence id.
- **This host.** Every `lab-sil.mjs` command on the recorded macOS host is `not_run` (see [plan02-simulation.md](implementation/evidence/digital-twin-v2/plan02-simulation.md)); physics contacts, separation, physical stop, sensor evidence and plant telemetry remain unverified.

## Plan 03 arm controller

Source `14d62c4` adds `integrations/arm-controller` (model pin, LinuxCNC simulation profile, bridge/arbiter, QtVCP HMI, export/trust chain) and
the LinuxCNC adapter + arm session in `lab-runtime`. The Lab pins the new artifact (schema hash `8b398544…`, 29 schemas: `arm-command`,
`arm-observation` added; v1/v2 schemas unchanged) and reads the arm as `controller_sim` samples when the backend exists. On this host the
`linuxcnc_sim` backend stays `installed:false`; `lab-sil.mjs doctor --backend linuxcnc_sim` records what is missing. The arm controller
artifact is exported unsigned for the record only and is refused by its own installer; the trust policy ships no key. Evidence:
`docs/implementation/evidence/digital-twin-v2/plan03-arm-hardware.md`; hashes in `config/simulation-compatibility.json` (`armController`).

## Plan 2026-11-08 LinkForge + IR-SIM (portable simulation tools)

Updated 2026-11-09. Source `fc21c1ee700499e624f229f9e336efeb88f2c7e7` adds the two portable Python tools and the Lab pins its artifact `fc8542864110c591…` (schema hash `e71730bb…` unchanged, portable tools digest `d383331a0abae825…`). Evidence: source `docs/implementation/evidence/linkforge-irsim/candidate-02/` (`qualification.json`, campaign, suite results, performance, screenshots) and Lab `docs/implementation/evidence/linkforge-irsim/candidate-02/` (physical-robot-lab regression + R-MOCK guard log). G-LF1, G-LF2, G-IR1, G-IR2 and G-INT1 are `tested`; G-IR3 is `not_run` because IR07 (thin-wall tunnelling) cannot be produced on the speed-capped plant and is covered by the swept-oracle unit test only; every gate keeps `accepted: false`. Nothing here changes R-MOCK, R-SIM, G-SIM-* or hardware gates.

- **Tools.** `linkforge_worker` (LinkForge 1.6.0 shadow validation of the engineering project's URDF: topology, shapes, inertials, parity wrapper that catches what the upstream parser silently repairs or drops; reversible `l_`/`j_`/`s_` name map) and `irsim_worker` (IR-SIM 2.12.0 2D navigation plant: differential drive, 2π LiDAR, fixed 20 ms tick, `|v| ≤ 0.5 m/s`). Both start with `python -I -B -X pycache_prefix` from pinned venvs; the Lab launcher (`lab:irsim`) re-hashes the tool roots against the pinned closure and fails closed on any extra file, symlink or bytecode.
- **Backend.** `engineering-irsim-2d-v1` runs in `simulation` mode with a source-driven fixed-step clock (`+5 s` steps, pause, pacing); mock and native backend sets are unchanged. Two-robot missions driven from source are serialized by the domain's `__venue_movement__` reservation; zone contention is proven by the campaign rig `IR-RIG-ZONE`, not by the fleet preset.
- **Lab UI.** Assembly → validation (report with original IDs, stale after an edit) → run → report/replay; 3D draws footprint, safety envelope, path, observed path and frames, while contact markers and LiDAR points are 2D-plan layers (disabled in 3D with a visible reason). Replay never issues commands.
- **Qualification record.** `linkforge-irsim-qualification/1`: identities before/after (source, Lab, tool closures), campaign summary, per-suite results and logs, license check, performance measurement, case and gate status. `pnpm test:acceptance -- linkforge-irsim` (source, `LAB_IRSIM_EVIDENCE_DIR`) refuses a dirty or re-pinned tree, a changed closure, a missing or corrupt artifact, an expected assertion that did not run, or any gate marked accepted.
- **Not evidence for.** Gazebo/Nav2, MoveIt2/LinuxCNC, calibration, physical stopping distance, sensor fidelity, cross-platform bitwise repeatability, hardware or venue acceptance. IR07 (thin-wall tunnelling) is `not_run` with its reason (the plant caps speed; covered by swept-oracle unit tests only). See the native handoff in the source evidence directory.

## Distribution and external gates

The [offline build instructions](../README.md) are in the README section **Gói offline có sẵn Node**. `node scripts/build-offline.mjs --out <new-directory>` packages compiled UI dependencies, pinned runtime/schemas, the build host's Node, licenses and an integrity manifest. Run `./start` using its vendored Node. Build separately for each target OS/architecture; the runtime's allowed UI origin stays `http://127.0.0.1:4175`.

Software checks do not close these separate gates:

| Gate | Evidence still required |
|---|---|
| Owner acceptance | Review the completed clean-pin software evidence and the separate external gates; R-MOCK remains unaccepted. |
| Human use and host setup | UX task timing, fresh macOS setup, actual network disconnection and host cold boot. |
| Linux | Build/run evidence on a fresh supported Linux host. |
| Physical tablet performance | Measurement on the intended device; desktop emulation identifies only its recorded host. |
| Simulation fidelity | Linux/provider binding, scenario and model-fidelity evidence under Plans 02/03; mock evidence cannot establish these. |
| Hardware/venue | Measured calibration, native sensor behavior, physical stop/custody and device/venue acceptance evidence. |

The renderer benchmark uses 2 AMRs, one arm and six tables for at least 60 seconds, with declared desktop 33 ms and emulated tablet 2D 50 ms p95 frame targets. It measures actual renderers with synthetic visual telemetry. It does not measure runtime throughput or physical robot behavior.
