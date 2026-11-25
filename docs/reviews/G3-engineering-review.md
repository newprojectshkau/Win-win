# G3 engineering review

Date: 2026-10-14 (Asia/Hong_Kong)  
Perspective: Experienced software engineering review; an independent review perspective, not a claim of professional credentials.  
Reviewed: [G3 plan](../G3-simulator-plan.md), [README](../../README.md), [v3 specification](../../model/投資模型規格_v3.md), [parameters](../../model/parameters.json), and [research comparison script](../../output/rr-comparison-2026-10-13/compare.py). This is a static architecture and repository review, not simulator execution or performance validation.

## Verdict

The simulator is feasible in this repository and in a normal local clone. The plan has the right core structure: an offline, deterministic strategy engine, separate simulation execution, independent expected answers and versioned evidence. Building a narrow `h=1` simulator is moderately challenging; the largest uncertainty is incomplete strategy and data contracts, rather than Python implementation.

Approve the implementation direction subject to the repairs below. Four development weeks is plausible for a CLI, synthetic fixtures, one historical data adapter and bounded historical acceptance after prerequisites are resolved. It is not a reliable estimate for data procurement, all configurable strategy variants, broker integration or a polished interactive interface.

## Findings and required repairs

### 1. Define the executable configuration contract before implementing stages — high priority

The [parameters file](../../model/parameters.json) mixes confirmed rules, provenance, unresolved `null` fields and explicitly disabled optional proposals. It is not yet an executable configuration schema. A generic loader could accidentally enable proposal values, accept incomplete rules, or interpret descriptive strings as algorithms.

Repair: introduce a validated runtime configuration derived from the authoritative specification and approved decision register. Explicitly allow supported rule versions and modes; reject unresolved required fields, unknown options, invalid ranges and unsupported `h>1` values. Validate custom slot ordering, observation-before-monitor timing and calendar compatibility. Preserve the existing source specification; write resolved runtime configurations as separate versioned artifacts. Freeze a copy for each run so editing a file during replay cannot alter decisions. Acceptance must include invalid configurations and prove optional proposals remain disabled.

### 2. Specify event order and order lifecycle — high priority

The plan correctly requires close-before-reverse, availability timestamps and session-end liquidation. However, a chronological clock alone does not decide what happens when a minute completes, a gate opens, a symbol generates an event and a session ends at the same timestamp. AM liquidation and PM observation both involve 12:30. Different iteration orders can produce different positions even with identical data.

Repair: define a deterministic ordering key, for example availability time plus an approved event-type priority, symbol identifier and sequence number. Keep bar interval time separate from observation availability time. Define whether boundary events are processed before liquidation and how the 10:00/13:00 anchor is obtained without reading a still-incomplete bar. Add boundary fixtures with multiple symbols and permuted input file order. Give order intents and fills explicit identifiers and states; a reversal opening must depend on the closure being filled under the configured adapter. A narrow immediate-fill adapter is acceptable initially if documented, but it must not silently claim coverage of delayed, partial or rejected fills.

### 3. Make data readiness inspectable and replay independent of fetching — high priority

The [existing script](../../output/rr-comparison-2026-10-13/compare.py) couples fetching with calculation, assumes 390 regular-session minutes, uses only ten fixed symbols and overwrites result files. Its saved single-day data cannot demonstrate Stage 1's 20-day screen and previous-day-to-current-day workflow. The plan recognizes this, but needs a concrete interface between G2 and G3.

Repair: define separate ingestion and replay commands, with replay working offline. Specify the minute-bar, daily-screening, universe-membership and calendar schemas, including timezone, availability time, adjustment basis, units, identifiers, duplicate policy and missing-data policy. Require a readiness report identifying the chosen trade dates, prior session and complete screening lookback, including point-in-time market-cap inputs. Use the small saved dataset only as a research regression fixture with its assumptions clearly labeled. Do not promise full historical acceptance until the readiness report passes.

### 4. Fix portability at the loader boundary — medium priority

The [parameters file](../../model/parameters.json) contains provenance paths under `/Users/macmini001/Desktop/Win-win/`. These do not exist in cloud or most other local folders. The research script uses `zoneinfo`; installed Python alone does not ensure that every host has suitable timezone data. The [README](../../README.md) also records macOS-only font paths in PDF tooling.

Repair: treat absolute provenance paths as descriptive metadata, never as runtime input locations. Resolve actual inputs relative to an explicit project/data root, or through command-line paths. Keep PDF tooling outside mandatory simulator dependencies. Document a supported Python version, install into a project virtual environment, lock dependencies, and provide a repeatable calendar/timezone-data policy. Test from a fresh clone and from a working directory other than the repository root. Repository location must not affect canonical results.

### 5. Specify numerical and audit contracts — medium priority

Threshold equality, closest-integer sizing and RR gate comparisons are sensitive to floating-point rounding. Recording a parameter version label is insufficient if the contents change while retaining that label. Mutable output files also make repeatability difficult to establish.

Repair: choose one explicit decimal precision/rounding policy for prices, thresholds and cash. Compare count-based RR ratios exactly where practical, after handling zero denominators, rather than rounding displayed ratios before gate decisions. Include dataset hashes, canonical configuration hash, approved rule identifier, calendar version and code revision; record whether uncommitted implementation changes were present. Use unique run directories and a final completion marker so interrupted runs cannot appear successful. Define canonical ledger ordering and exclude wall-clock timestamps only from the comparison representation, not from provenance records.

### 6. Turn acceptance ownership into an executable release gate — medium priority

The proposed acceptance cases are strong. They need a runnable contract that differentiates a synthetic correctness pass from a historical-data pass, and prevents the developer from silently changing expected outputs to match the implementation.

Repair: independently review expected fixture values before writing stage code; link each fixture to a rule decision. Add negative-input tests, same-time event ordering, decimal equality, unavailable close prices and output ledger reconciliation. Provide one documented test command and a small offline end-to-end smoke command. Produce an acceptance matrix with passed, failed, skipped and blocked cases; record reviewer sign-off separately from command success. A basic CI check should run the offline suite on future changes. Avoid duplicating every implementation branch with tests that simply restate the code.

## Repository versus local folder

| Location | Practical assessment | Required setup |
|---|---|---|
| Existing cloud checkout | Suitable for development, review and bounded offline replay. Remote preview access can support a later interface. | Virtual environment, reproducible install, configured external data/output storage and explicit artifact export before environment disposal. Measure memory/disk before broad-universe runs. |
| Normal local Git clone | Equally suitable; stable local datasets and a browser interface can be convenient for repeated research. | Same locked dependencies and CLI; portable path handling, timezone/calendar data and ignored run directories. Git revision supports audit provenance. |
| Loose copied folder | Can run after packaging, but weakens revision tracking and makes updates/reviews harder. | Prefer a clone. If copies are supported, record a source/package content hash instead of assuming Git metadata exists. |

A separate worktree is unnecessary. The repository is the versioned home for engine code, configuration schemas and small fixtures; large licensed datasets and generated run bundles should use separately configured locations. Local versus cloud should not require different trading logic.

## Suggested delivery boundary

For the first G3 acceptance, implement the approved default AM/PM schedule, `h=1`, gate enable/disable, required screening/selection/sizing parameters, and one explicitly approved Renko mode. A second Renko mode or arbitrary slot layouts require their own decisions and fixtures; list them as supported or deferred rather than implying that a selectable control already works. This is an implementation staging proposal, not a change to the strategy's eventual configurable requirements.

Keep the initial CLI and machine-readable outputs in the four-week core estimate. A thin run/results viewer can follow those contracts; a full editor with version management, asynchronous runs and detailed charts should receive a separate estimate. If both Renko modes, custom schedules and a polished interface must ship together, re-estimate after their rules and interaction scope are approved. Begin large historical runs only after a small multi-session replay passes and its memory/output footprint is measured.

The architecture should proceed now with contracts and synthetic fixtures. Final G3 sign-off remains conditional on approved executable rules, usable point-in-time historical inputs and independently reviewed acceptance results.
