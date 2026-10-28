# G3 review: investor usability and flexibility

Date: 2026-10-14 (Asia/Hong_Kong)  
Perspective: investor/operator review; this is an analytical review, not a claim of professional credentials.  
Reviewed proposal: [G3 simulator plan](../G3-simulator-plan.md)

## Verdict

Proceed with G3, subject to a small, explicit operator interface and the unresolved-rule decisions already required by the plan. The proposed separation of strategy, replay, fills and audit records is suitable for reviewing this strategy. A CLI and JSON file are a useful engineering baseline, but are insufficient as the final comfortable workflow for an investor expected to change settings, understand a skipped session and compare runs.

The engine can support a practical research workflow without live brokerage integration. G3 should prove that approved rules execute correctly and can be understood. It does not establish profitability, suitable account sizing, or readiness to place live orders.

## Basis for the review

- The [README](../../README.md) identifies v3 and current parameters as authoritative and describes the repository as research/specifications, not an execution system.
- [v3 sections 2–7](../../model/投資模型規格_v3.md) require editable stage settings, independent AM/PM lists, the configurable trade gate and distinct `k` and `h` controls. Section 7 explicitly requires changes to reach the engine and every stage output.
- [parameters.json](../../model/parameters.json) lists intended editable fields, unresolved rules and disabled optional overlays. It also records that the interface is not implemented and core logic is incomplete.
- [v3 sections 5, 6 and 8](../../model/投資模型規格_v3.md) distinguish a gate passing from an entry, signals from attainable fills, and optional overlays from the faithful core.

## Prioritized findings

| Priority | Finding | Concrete change proposed |
|---|---|---|
| Required before accepted runs | Flexible controls can create settings whose meanings are undefined. `h=2/3`, alternative Renko modes and custom sessions are not all fully specified. An editable field is not evidence that its rule is executable. | Validate configuration against the supported rule version; show unsupported choices with the missing decision, and block execution when a run depends on it. Keep h=1 available. A separate experimental version may run only after its rules are explicit; it must not receive faithful-core acceptance. |
| Required before operator sign-off | A no-trade result is ambiguous: gate rejection, no first event, missing data and failed execution are materially different. | Show session and symbol reason codes with plain-language explanations. Distinguish `skipped_by_strategy`, `flat_no_event`, `blocked_by_configuration`, `blocked_by_data`, `execution_rejected` and `run_failed`. Undefined RR stays undefined; do not display it as zero. |
| Required before operator sign-off | Settings can look correct while the engine uses old values; the specification explicitly warns about this. | Display the effective configuration captured at run start, lock it for that run, and record its version/hash. Editing creates a new draft/version and a new run, never alters historical evidence. |
| Required before operator sign-off | The existing roadmap website can reflect older rules. Repurposing its displays without reconciliation could mislead users about current times or formulas. | A review interface must read stage outputs and effective configuration from the engine. Clearly label individual RR as `B/(R+1)` for the core and portfolio RR as `ΣB/ΣR`; label `h` as reverse-confirmation events. |
| Required before operator sign-off | Per-symbol notional is not an account risk budget. Ten entries at about US$1,000 can imply about US$10,000 gross exposure, and repeated reversals increase turnover and costs. | Report actual gross/net exposure, long/short quantities, turnover, reversal count and fill/cost assumptions as diagnostics. Do not add position caps, stops or shrink quantities to the faithful core. Separate any optional execution constraints and show affected orders. |
| Recommended for first review interface | Session times are easy to misunderstand from Hong Kong; US daylight saving changes the conversion. | Present exchange time and Asia/Hong_Kong time, with dates and offsets. For example, 09:30 New York is 21:30 Hong Kong in US daylight saving and 22:30 in standard time; PM sessions can end on the next Hong Kong date. |
| Recommended for first review interface | Comparing headline results alone makes it hard to see why an alternative changed behavior. | Compare two frozen runs with a settings diff, common dataset identifiers and stage-level differences. Flag comparisons with changed datasets or execution assumptions. Keep parameter comparison explicit rather than automatically optimizing for returns. |

## Minimum practical interface

Use a lightweight browser review interface backed by the same CLI/replay engine. It should work in a local browser and through the cloud environment's supported preview connection. Keep saved configuration, run bundles and results portable between those environments. The interface framework can be chosen by the implementation team; no complex frontend is required for G3.

1. **Prepare run.** Select immutable dataset, dates and approved rule version. Start with a faithful v3 preset. Show data coverage, missing prerequisites and supported settings before execution. Group controls by the five stages, show units, validate ranges and session relationships, and offer reset-to-version defaults. Explain that target notional may be slightly exceeded by nearest-integer sizing.
2. **Review settings.** Show the full effective configuration and changes from the preset. Keep confirmed rules, approved decisions, experimental variants and execution assumptions visibly distinct. Unsupported choices should identify the exact unresolved rule instead of falling back silently. A disabled gate still waits for the first entry event.
3. **Run and inspect.** Show progress and passed/failed/blocked status. Present a five-stage summary: screening counts and rejection values; independent AM/PM rankings; quantities and rounding differences; baseline/current portfolio counts and gate outcome; event/order/fill transitions and final positions. Opening a symbol reveals its timestamped price/event/position timeline, including data-availability times and separate signal/fill prices.
4. **Compare and export.** Choose two completed runs for a configuration and output diff. Download configuration, input identifiers/hashes, stage tables, ledgers, validation results and a readable summary. A saved run should remain reviewable without restarting the simulator.

For the first G3 release, correctness/reason tables and export matter more than animated charts or a P&L dashboard. If P&L is shown for ledger reconciliation, label its fill/cost assumptions and keep it separate from a strategy-performance claim.

## Operator acceptance exercises

These supplement the numerical and causal acceptance cases in the implementation plan; they do not replace them.

- Change target notional, save a new version, run a sizing fixture and verify that both the effective settings and quantities changed. The previous run must remain unchanged.
- Inspect a session whose gate failed and a session whose gate passed but had no first events. The operator should be able to explain why neither traded without reading source code.
- Supply missing data and a zero-denominator case. The interface should display the precise input/rule issue, preserve null RR and distinguish rejection from a successful empty trading session.
- Compare gate-enabled and gate-disabled runs using the same dataset and execution settings. Show the gate difference and which entry decisions changed; disabling the gate must not create immediate positions.
- Attempt h=2 while its reset rule is unresolved. Execution should be blocked with a clear reason, rather than producing an apparently accepted result.
- Inspect an AM/PM boundary and a US daylight-saving date. Exchange times, Hong Kong dates, observation periods and liquidation times should agree with the accepted calendar rules.
- Export a run bundle and use it to trace a reversal from inputs to signal, close fill, reverse fill and reconciled final holdings.

## Scope and schedule recommendation

Keep the four-week estimate for the correctness engine conditional on rule/data readiness. The plan currently places a review interface after the core becomes stable; therefore do not assume a polished browser interface is already included in that estimate. Budget the minimal interface explicitly or add it as a follow-on usability milestone. Configuration capture, reason codes and portable bundles belong in the engine from the start, so a later interface does not require redesign.

Defer parameter-search automation, custom portfolio weights, unsupported h/mode/session variants, sophisticated visualizations, multi-user accounts, live feeds and broker order controls. Their future addition should preserve the faithful v3 preset, versioned alternatives and auditable run history. G4 can evaluate performance and robustness once G3 is accepted.

## Recommended plan amendments

Make operator sign-off an explicit G3 review item; define the no-trade/status vocabulary; capture immutable effective settings at run start; add exposure/cost diagnostics without changing core strategy; and state whether the minimal browser interface is inside or after the four-week engine estimate. These changes make the existing design more usable without expanding G3 into a live trading product.
