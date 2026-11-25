# G3 simulator implementation plan

Date: 2026-10-14 (Asia/Hong_Kong)  
Status: Revised after three independent agent reviews; proposed implementation plan; simulator not implemented

## Purpose and authority

G3 is the roadmap milestone **simulator correctness**, distinct from strategy Stage 3 (position sizing and portfolio RR). Deliver a deterministic five-stage historical simulator whose results match agreed hand calculations, can be replayed, and never use information before it became available.

The [README](../README.md) identifies the [v3 specification](../model/投資模型規格_v3.md) and [current parameters](../model/parameters.json) as authoritative. Use the [transcript reconciliation](../model/逐字稿差異核對.md) for supporting evidence. The [website roadmap](../sites/investment-roadmap-hk/dist/index.html) provides milestone context, but can reflect earlier versions. New engineering proposals below require explicit versioning; they are not already confirmed strategy rules.

G3 verifies implementation correctness. Profitability and sample-out-of-sample validation belong to G4; live execution resilience and broker integration belong to later milestones. No live orders are part of this plan.

## Current repository and environment

The repository contains specifications, source transcripts/photos, a self-contained website, PDFs, and an assumed RR comparison script with saved data. There is no complete simulator or trading engine. `parameters.json` explicitly records `core_logic_complete=false` and unresolved rules.

Python 3.12 is available in the cloud environment. The static website returned HTTP 200, and offline replay reproduced all 20 saved symbol/session RR results and event logs. This validates the existing assumed research model, not the v3 strategy. Do not run the comparison script's network-fetching `main()` as a simulator: it overwrites tracked results and uses a fixed date inside a rolling data window. PDF regeneration is optional; retained scripts use macOS fonts.

## Prerequisites and rule decisions (G1/G2)

Create a versioned decision register with each unresolved item, source evidence, proposed options, chosen answer, strategy-owner confirmation, and hand-calculated acceptance cases. Keep unresolved values visible and reject runs that depend on them rather than filling them silently.

Required decisions include:

- Minute price field, timestamp meaning, and when a completed observation becomes usable.
- Renko reference prices, subsequent anchors, B counting, R scope, multiple threshold crossings within one minute, equality, window resets, and dollar versus percentage calculations.
- Stage 1 historical day convention, price sampling, fluctuation denominator, point-in-time universe and company-action treatment.
- Candidate ties, shortages, missing-data treatment, and session boundary/half-day behavior.
- Quantity reference price, nearest-integer ties, and when quantities may be refreshed.
- Zero-denominator and equal-RR gate actions. Preserve `null` plus `zero_denominator` where the portfolio formula is undefined; do not add a smoothing constant.
- Simulated order timing, fill prices, execution limitations and costs. Distinguish strategy signals from fills.

Start with the confirmed `h=1` behavior. Defer `h=2/3` until their counting, anchor and reset rules are defined. G2 must supply suitably licensed historical minute data, point-in-time screening inputs and calendars. Synthetic fixtures can support development before these arrive; they cannot establish historical data readiness or complete G2.

### Required decisions highlighted by specialist review

Approve a worked causal timeline before coding Stages 4–5: bar start/end, availability time, gate evaluation, initial-price observation, signal, order submission and eligible fill. A bar labelled 10:00 may close at 10:01; its close cannot be used at 10:00. The observation threshold must not use a later Stage 5 initial price. Define event precedence at equal timestamps, including AM liquidation and PM observation at 12:30, and prevent an expired slot from reopening.

Specify session-end execution separately. A next-bar-open model has no regular-session next bar after 16:00. Choose and disclose an idealized exit mark, a supported auction model, or another explicitly approved execution convention. Do not silently move the exit earlier or fill the next day. If data cannot support an executable exit, record the limitation and any residual inventory.

One-minute OHLC does not identify intraminute high/low order. Adopt an approved sampled-price event model for the first release; never silently infer a high-first or low-first path. Specify separately how a multi-threshold jump contributes to B and how many execution actions that observation may generate.

G2 handoff must include documented schemas for minute bars, daily screening values, universe membership and calendars: stable security identifiers, units, interval/availability timestamps, adjustment bases, duplicate/missing-data policy and dataset hashes. A readiness report must verify the selected trade dates, previous scoring session and complete approved screening lookback. Include delisted securities, publication delays, splits and symbol changes where relevant; a supplied frozen universe supports partial testing but not complete Stage 1 acceptance.

## Implementation sequence

| Step | Work | Deliverable and exit condition |
|---|---|---|
| 1. Freeze executable rules | Resolve the required decisions above and specify expected answers independently of code. | Versioned rule register and strategy-owner-approved fixtures; no unresolved rule used in an accepted run. |
| 2. Replay foundation | Validate schemas, timestamps, completeness and company actions; feed observations through a chronological clock that reveals only available information. | Data adapters, calendar and deterministic event stream; rejected inputs have explicit reasons. |
| 3. Stages 1–3 | Implement screening, independent AM/PM selection using `B/(R+1)`, integer quantities nearest target notional, and portfolio RR `ΣB/ΣR`. | Auditable screening values, rankings, quantities and previous-session baselines matching fixtures. |
| 4. Stages 4–5 | Implement whole-list session gating, per-symbol first-event entry, same-direction hold, close-before-reverse and session-end liquidation. | Shared strategy state machine plus an explicitly configured simulation adapter; transitions match fixtures. |
| 5. Verification and review | Run acceptance tests, multi-session historical replay, repeatability and future-data-leakage checks. | Test results, traceable event/fill ledgers and G3 acceptance report reviewed by developer and quantitative reviewer. |

## Proposed software organization

Use the existing checkout in cloud or a normal local clone; no separate worktree is required. A proposed Python package layout is `src/winwin/` with modules for configuration, data/calendar, Renko events, screening/selection, sizing, gates, strategy state, simulation execution, and audit output. Add independently authored fixtures and tests under `tests/`, and a command-line replay entry point. Dependency choices and a locked installation workflow should be decided during implementation, not inferred from the existing standard-library research script.

The strategy core should accept data events and emit decisions without accessing broker APIs, network calls or UI state. A simulation adapter supplies fills and costs. This separation lets later execution work reuse the strategy rules without assuming simulated fills are attainable live.

Treat the existing parameter document as a specification, not a ready runtime configuration. Build a validated executable configuration from approved decisions; reject unresolved required fields, invalid settings and unsupported modes. Freeze its effective contents at run start and record a canonical hash. Optional proposal values remain disabled unless explicitly selected in a separately labelled configuration.

For the initial acceptance, bound support to `h=1`, the approved default AM/PM schedule, gate enable/disable, required numeric screening/selection/sizing controls and one approved Renko mode. The eventual dollar/percentage and custom-slot requirements remain in the backlog: each needs its own approved rules and fixtures before it becomes an enabled control. This staging proposal does not change the strategy specification.

Separate data ingestion from offline replay. Resolve runtime paths from an explicit project/data root; the macOS absolute paths in current provenance metadata are descriptive only. Use the same packaged engine, supported Python version, locked dependencies and pinned calendar/timezone policy in cloud and local clones. Test from a working directory outside the checkout. Prefer a Git clone over a loose folder; if copied folders are supported, capture a source-content hash instead of assuming Git metadata exists. Measure resource usage on a small replay before broad-universe runs.

Use explicit decimal precision and rounding for prices/thresholds/cash. Preserve RR numerators and denominators and compare defined ratios by integer cross-products, rather than rounded display values. Define canonical event ordering and output serialization. Each run bundle includes configuration/data hashes, code revision and dirty-state status, execution assumptions, completed/failed status and a completion marker. Interrupted runs cannot appear complete.

Distinguish an idealized fill adapter for signal correctness from an execution-constrained adapter. The initial idealized adapter must state which borrow, buying-power, delay, rejection and partial-fill constraints it does not model. A constrained adapter tracks actual inventory and pending orders; reverse entry depends on confirmed closure, and stale/pending opening intents are handled at slot end. Its extra scope requires data and a separate estimate. Neither adapter silently adds optional strategy risk overlays.

Store immutable input datasets outside source control unless intentionally small fixtures. Write each run to a separate ignored output directory, preserving the existing research files. Record code revision, parameter/rule version, dataset identifiers and hashes, timezone/calendar version, execution assumptions and run status. Do not store credentials in any manifest or log.

## Confirmed strategy behavior to preserve

- Stage 1 uses the four specified screening conditions; do not add optional filters as core rules.
- Stage 2 has independent previous-day AM 09:30–12:30 and PM 12:30–16:00 candidate lists, with overlap allowed. Individual RR is `B/(R+1)`.
- Stage 3 chooses positive integer shares nearest the configurable target (default US$1,000). Portfolio RR is summed counts divided by summed reversals, with no `+1` or weighting.
- Stage 4 compares today's AM 09:30–10:00 or PM 12:30–13:00 observation RR against the corresponding previous-day full-slot baseline. Gate decisions apply to the whole candidate list.
- Stage 5 records initial prices at 10:00/13:00 after gate passage, waits for each symbol's first event, holds on same-direction events without adding shares, and closes before reversing on an opposite event with `h=1`. Liquidate at 12:30/16:00 even without another Renko event.
- Strategy times use `America/New_York`; Hong Kong display times must account for daylight saving. Interval endpoints and special sessions still require explicit decisions.
- Optional risk overlays and research variants must be separate configurations with visible differences from the faithful core.

## Required acceptance cases

1. No first event means no position; gate passage alone creates no trade.
2. Same-direction events hold the existing quantity without adding shares.
3. An opposite event with `h=1` requests closure before opening the opposite position; simulated fill ordering is observable.
4. Session end triggers liquidation without requiring a new Renko event, under the agreed fill model.
5. Price US$335 and target US$1,000 selects 3 shares worth US$1,005; also cover US$900 and US$100 examples and an agreed equal-distance tie.
6. Portfolio RR uses `ΣB/ΣR`, not the mean of individual RRs; zero denominator remains explicitly undefined.
7. Greater/lower/equal RR and unavailable-input gate cases match the agreed policies, including the gate-disabled variant.
8. AM and PM selection are independent; boundaries cause no unintended double counting and calendar edge cases follow the agreed rules.
9. Hand-calculated minute paths cover first events, reversals, no movement, exact thresholds and multi-threshold jumps under each supported Renko mode.
10. Changing observations strictly after time *t* cannot change decisions produced by *t*. Availability timestamps, previous-day selection and screening inputs are included in this check.
11. Identical input data, code, rules and parameters reproduce identical canonical decision/fill outputs; volatile run timestamps are excluded from comparison.
12. Each signal, order intent, fill and position transition is traceable to its inputs and active version; ledger quantities and cash reconcile.
13. Equal ratios with different denominators remain equal; exact-threshold and nearest-quantity tie cases obey the approved numerical policy.
14. Permuting input-file order preserves results; duplicate/out-of-order observations are handled according to the data contract. Same-timestamp exit/signal events cannot reopen expired sessions.
15. Missing minutes, halts, insufficient warm-up, delayed market-cap publication and splits are surfaced rather than silently filled or ignored. No fill occurs before its order or at an unavailable price.
16. Invalid or unsupported configurations are blocked. If constrained execution is supported, test rejected shorts, insufficient buying power, delayed/partial closure and cancellation of pending openings at session end; otherwise mark those capabilities unsupported.

Tests must exercise intended cases and report passed, failed, skipped and unrun outcomes separately. Independently calculated fixtures are the correctness oracle; reproducing the old comparison script alone is insufficient.

Provide a documented offline test command and small end-to-end replay command, with a CI correctness gate. Report synthetic rule correctness, historical-data readiness and execution realism separately. Command success does not replace reviewer sign-off, and blocked or skipped required cases prevent full acceptance.

## Interface proposal for review

Begin with a reproducible CLI and a saved configuration file. Propose a lightweight local/cloud-accessible review interface once the core is stable: editable versioned parameters, input validation, run controls, five-stage results, a per-symbol timeline and a downloadable audit bundle. The interface must distinguish confirmed rules, unresolved items, experimental choices and execution assumptions. Saving parameters must update the actual engine configuration, not only the displayed values.

The minimum review workflow is: choose a dataset and approved rule version, inspect/validate settings, start a replay, inspect stage outputs and reasons for no trade, then export evidence. Profitability displays, if provided for diagnosis, must clearly identify the fill and cost assumptions and must not imply G4 validation.

The investor review recommends four browser views:

| View | Required behavior |
|---|---|
| Prepare | Select dataset, dates and rule version; show coverage, supported controls, units, defaults and blocking decisions. |
| Review settings | Show frozen effective configuration and changes from the faithful preset; distinguish approved rules, experiments and fill assumptions. |
| Inspect results | Show five-stage tables and a symbol timeline separating observations, signals, orders, fills and positions; explain every skip or failure. |
| Compare/export | Compare frozen settings and stage outputs; flag dataset/assumption changes; export a reviewable run bundle. |

Use explicit statuses such as `skipped_by_strategy`, `flat_no_event`, `blocked_by_configuration`, `blocked_by_data`, `execution_rejected` and `run_failed`. Keep undefined RR distinct from zero. Display dated New York and Hong Kong times with daylight-saving-aware conversion. Show actual gross/net exposure, long/short quantities, turnover, reversals and assumed costs as diagnostics without changing core quantities or adding risk limits.

Operator exercises must demonstrate that changing target notional changes engine quantities while preserving the earlier run; gate failure is distinguishable from gate passage with no first event; undefined/missing inputs are explained; unsupported h/mode choices are blocked; disabling the gate still waits for entry events; and exported evidence traces a complete reversal. Operator acceptance covers this interface separately from numerical core acceptance.

## Schedule and acceptance ownership

Estimate four development weeks with one full-time developer, part-time quantitative review and a strategy owner available for decisions. This corresponds to roadmap weeks 3–6 (2026-11-02 through 2026-11-29), conditional on prerequisites; it is not a delivery commitment.

| Development week | Focus |
|---|---|
| 1 | Rule register, independently calculated fixtures, configuration/data contracts and replay clock. |
| 2 | Renko events and Stages 1–3 with unit and integration acceptance tests. |
| 3 | Stages 4–5, fill adapter, audit ledger and end-to-end fixtures. |
| 4 | Historical replay, calendar/missing-data cases, causality and repeatability checks, review and fixes. |

Infrastructure and synthetic-fixture work can overlap G2. Actual historical acceptance depends on usable data. Rule ambiguity, data procurement and execution modeling can extend the estimate. The developer verifies implementation; the quantitative reviewer independently checks expected outputs; the strategy owner confirms strategy choices. Record each acceptance decision and any remaining limitation in the G3 report.

The four-week estimate covers the bounded CLI core, immutable configuration, reason codes, audit bundles, one data adapter and core correctness tests after rule/data readiness. Historical-data procurement, realistic broker execution constraints, additional undefined variants and a polished interface are excluded. Schedule and estimate the minimal browser review interface as a follow-on work item once output contracts are stable; the full investor/operator workflow is complete only after its separate usability acceptance. No fixed additional duration is promised before that interface scope is agreed.

## Specialist reviews

Three independent agents reviewed the initial draft through the requested professional perspectives. These are analytical agent reviews, not claims of licensed professional credentials or actual trader/investor endorsement. The reports are retained as reviews of the initial draft; the revisions above incorporate their recommendations.

| Review | Verdict | Changes incorporated |
|---|---|---|
| [Programmatic trading](reviews/G3-trading-review.md) | Infrastructure can proceed; faithful historical sign-off depends on causal timing, event rules and point-in-time data. | Bar/fill timeline, 16:00 exit policy, sampling limits, data handoff, exact RR comparisons, execution scope and adversarial tests. |
| [Software engineering](reviews/G3-engineering-review.md) | Feasible in cloud or local clone; moderate complexity with rule/data uncertainty. | Validated immutable config, deterministic ordering, portable paths, offline replay, reproducibility/CI contracts and bounded release scope. |
| [Investor usability](reviews/G3-investor-review.md) | Conditional proceed; CLI alone is insufficient for comfortable investor operation. | Four-view browser workflow, reason codes, effective settings, comparison/export, exposure diagnostics, dual timezones and separate usability acceptance. |

Recommended next action: complete the G1 decision register and independently calculated fixtures, while preparing the G2 data contract and replay skeleton. Implementation and professional sign-off remain future work; these reviews do not establish G3 completion or profitability.
