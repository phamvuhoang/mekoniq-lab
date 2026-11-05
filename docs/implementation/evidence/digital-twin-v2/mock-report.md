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
