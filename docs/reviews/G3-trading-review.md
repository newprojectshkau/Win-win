# G3 review: programmatic trading feasibility

Date: 2026-10-14 (Asia/Hong_Kong)  
Perspective: independent review through a programmatic-trading lens; this is an agent review, not a claim of professional credentials.  
Reviewed: [implementation plan](../G3-simulator-plan.md), [README](../../README.md), [v3 specification](../../model/投資模型規格_v3.md), [parameters](../../model/parameters.json), [transcript reconciliation](../../model/逐字稿差異核對.md), and [existing comparison script](../../output/rr-comparison-2026-10-13/compare.py).

## Verdict

**Proceed with the replay infrastructure and independent fixtures. Do not sign off a faithful historical trading simulation until the rule and execution decisions below are resolved.** The five-stage decomposition, explicit unresolved-rule register, causality tests, separation of signals from fills, and deferral of `h>1` are appropriate. Most algorithmic work is manageable. The difficult parts are authoritative event definitions, historical point-in-time inputs and attainable execution assumptions, rather than computing RR.

Four development weeks is a plausible planning allowance for a narrowly scoped `h=1` simulator after the necessary decisions and usable data arrive. It does not cover obtaining a full historical IB-compatible universe, reconstructing historical short availability, or implementing a realistic broker execution system. Those should be named limitations or separately estimated prerequisites.

## Findings and concrete repairs

### P0 — Specify a complete causal timeline, especially at 10:00 and 16:00

**Confirmed evidence:** v3 sections 5–6 require an observation gate, a new Stage 5 initial price at 10:00/13:00, and liquidation at 12:30/16:00. `sampling.price_field`, `sampling.confirmation_time_rule`, interval boundaries and `execution.fill_simulation_rule` remain unresolved. The reconciliation explicitly prohibits using the later Stage 5 initial price to compute the earlier observation's dollar threshold.

**Difficulty:** a provider's bar labelled 09:59 may cover 09:59–10:00 and become usable at or after 10:00. A bar labelled 10:00 may cover 10:00–10:01. Its closing price cannot be treated as known at 10:00. Similarly, detecting an event from the closing minute and filling it retrospectively at that minute's price creates optimistic execution. A next-bar-open model has no regular-session next bar after 16:00. Merely saying “liquidate at the session end” does not solve this.

**Repair:** before implementing Stages 4–5, approve a worked timeline specifying bar start, bar end, availability, gate evaluation, initial-price observation, signal creation, order submission and eligible fill time. Add an explicit scheduled-exit policy: an idealized contemporaneous mark for signal correctness, a supported auction model, or a separately labelled execution convention. An earlier exit is a strategy variant, not an invisible fix. Avoid claiming a fill is executable when the dataset lacks the required information.

**Acceptance additions:** a 10:00-labelled bar cannot influence the 10:00 gate before its data are available; no entry fires from the same observation used solely to establish the new initial anchor; an event coinciding with liquidation cannot reopen the expired slot; the exit model never silently uses a next-day fill.

### P0 — One-minute inputs do not reveal intraminute event order

**Confirmed evidence:** v3 specifies one-minute sampling, but leaves B counting, subsequent anchors, R scope, multiple crossings, threshold equality and percentage compounding unresolved. The old comparison script uses minute closes, carries an anchor by completed dollar increments, and counts multiple crossings. Those are research assumptions, not the executable v3 definition.

**Difficulty:** OHLC bars do not disclose whether a high occurred before a low. Using them to generate both upward and downward Renko events requires an assumed intraminute path. Minute-close sampling is deterministic but intentionally misses movements between samples. A multi-threshold move also needs two distinct decisions: how many B events exist, and whether one observation can produce several execution actions.

**Repair:** approve one event-generation contract for the first release. State the sampled price, anchor updates, event count, reversal scope and permitted execution actions per observation. If close-only sampling is chosen, identify it as an agreed sampled-price model. Require finer data for any future intraminute path model rather than inventing a path silently. Use stable decimal/integer arithmetic and explicit rounding rules for thresholds.

**Acceptance additions:** gaps across three thresholds; first downward event; exact threshold and one increment below it; direction reversal after a gap; unchanged price; dollar and percentage modes; and a sample that would imply different events under high-first versus low-first interpretations. These should prove which interpretation is supported, not compare two implementations of the same assumption.

### P0 — Resolve screening as-of time and procure point-in-time inputs

**Confirmed evidence:** Stage 1 uses 20-day average market capitalization, volume, fluctuation and price, while Stages 2–3 prepare previous-day rankings and quantities. The specification prohibits using later information to establish an earlier universe. The exact IB security scope, day convention and price/fluctuation definitions are unresolved. The comparison script explicitly uses end-of-test-day index weights for a descriptive selection and omits Stage 1 entirely.

**Difficulty:** current ticker lists and retrospectively revised market-cap series can introduce survivorship and look-ahead bias. Historical market cap may require contemporaneous shares outstanding as well as price; minute prices alone are insufficient. At least 20 eligible historical days plus the scoring day are needed, with the exact overlap dependent on the approved convention. Splits can corrupt thresholds, quantities and counts when daily and minute data have inconsistent adjustment bases.

**Repair:** define when Stage 1 is evaluated, which completed days enter it, and how late publications/revisions are handled. Require stable security identifiers, valid-date symbol mappings, historical universe snapshots, calendar data and documented adjustment bases. Separate event/effective time from information-availability time. Prefer internally consistent tradable price data and explicitly normalize history for company actions. A frozen supplied universe can support an honest partial replay but cannot count as full Stage 1/G3 historical acceptance.

**Acceptance additions:** newly listed and delisted securities, ticker changes, a split between scoring and trading days, insufficient warm-up, a market-cap update published after the preparation cutoff, and the distinction between a market holiday and a missing session. Missing minutes or halts must not be silently forward-filled into executable prices.

### P1 — Distinguish the signal simulator from executable inventory

**Confirmed evidence:** v3 section 6 and `execution` require close-before-reverse, borrow and buying-power checks, and broker reconciliation. They do not provide a fill model or guarantee immediate execution. Additional portfolio risk limits remain disabled proposals.

**Difficulty:** an opposite signal is not evidence that the prior position has closed. A rejected short, partial close or unavailable quote can leave actual inventory different from the strategy's desired position. Ten US$1,000 allocations also do not establish that the account has adequate buying power. Short-sale restrictions and unavailable borrow can affect trade feasibility without changing the underlying signal rule.

**Repair:** define two explicit simulation capabilities: a signal-correctness adapter with idealized fills, and an execution-constrained adapter when the necessary inputs exist. Record assumptions and unsupported constraints in the run manifest. In the constrained adapter, track pending orders and actual filled quantities; opening a reversal must depend on confirmation of closure. Specify what happens to stale intents when another signal or a slot-end event arrives. Parameterize account resources and costs without silently adding the optional strategy risk overlays.

**Acceptance additions:** rejected short entry, insufficient buying power, partial close, delayed close with a newer signal, and slot-end cancellation of pending opening orders. If these are outside the first release, reject configurations claiming those capabilities and label the outputs as idealized execution rather than failing G3 against an unstated broker model.

### P1 — Make RR comparisons and exceptional states exact and visible

**Confirmed evidence:** individual RR is `B/(R+1)`; portfolio RR is `sum(B)/sum(R)` with no smoothing. Zero portfolio denominator, equal gate values, missing data and ties remain unresolved. The whole candidate basket is gated.

**Difficulty:** floating-point comparisons can turn mathematically equal ratios into unequal ones. Zero reversals are plausible in a short observation window. Treating an unavailable candidate as a zero count, or dropping it and recomputing the basket, changes the gate. A full previous-day baseline versus a 30-minute current observation is intentional under the present interpretation, but their different horizons make invalid reset/count conventions especially damaging.

**Repair:** preserve numerator/denominator counts and compare finite ratios by integer cross-products. Distinguish `valid`, `zero_denominator`, `missing_data` and `unresolved_rule`; do not merge them into numeric zero. Resolve equal-RR and unavailable-basket policies with the strategy owner. Keep the confirmed baseline horizon; a same-30-minute comparison is a labelled research variant.

**Acceptance additions:** exact equal ratios with different denominators; all B and R zero; B positive with R zero; one missing candidate in the selected basket; duplicate symbols/security identifiers; and deterministic candidate tie handling.

### P1 — Add event precedence and operational replay invariants

**Confirmed evidence:** AM and PM lists are independent and may overlap; both use the 12:30 boundary. Half-days and interval endpoints are unresolved. The plan correctly requests calendar and boundary tests but does not yet give ordering rules.

**Repair:** define a deterministic priority for data availability, gate decisions, signal processing, fills and scheduled exits at equal timestamps. Define ownership of the 12:30 observation, clear expired slot state, and keep AM inventory separate from PM eligibility. The PM observation starting at 12:30 must not rely on an AM fill or anchor unless the approved rule explicitly requires that dependency. Include daylight-saving transitions, early closes, gaps and halts in the calendar policy.

**Acceptance additions:** the same symbol appears in both slots; a 12:30 AM event and PM observation coincide; a half-day ends during or before the PM observation; data records arrive out of order or are duplicated. Enforce no fill before its order, no double fill, close-before-reverse, and inventory/cash reconciliation. A session without an attainable exit must surface an unresolved position, not be reported as flat by fiat.

## Recommended scope and sign-off

Keep G3 focused on approved one-minute event semantics, `h=1`, the configured five-stage workflow, deterministic replay and independently checked outputs. Include only execution behavior that the selected adapter and inputs can support. Require separate evidence for synthetic rule correctness, historical data readiness and fill realism; success in one does not establish the others.

Before sign-off, the strategy owner should approve the causal timeline and rule register, the quantitative reviewer should independently calculate adversarial fixtures, and the developer should produce the replay/audit evidence. Historical results should disclose input coverage, rejected/skipped sessions, execution assumptions and residual positions. Profitability remains G4, and live broker integration remains later work.
