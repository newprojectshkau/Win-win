# IBKR US equity fee model — 31 October 2026

The complete bilingual research and limitations are published in [the fee reference](../sites/g3-platform/ibkr-fees.html). Source retrieval fingerprints are in [the manifest](IBKR-fee-source-manifest.json).


## Findings and scope

Reviewed October 31, 2026 (Australia/Melbourne). Whole US shares, IBKR Pro, SmartRouting. IBKR Lite eligibility is not assumed for a Hong Kong resident. The panel defaults to Fixed, with Tiered estimates and legacy custom fees available. Account entity, actual pricing plan and intermediary markups remain unconfirmed.


## Today's zero rate is not a historical rate

IBKR currently shows zero TAF with a Q4 2026 holiday footnote. FINRA's dated versions confirm $0.000195/share, capped at $9.79, for January–September, then zero for October–December. The SEC confirms $20.60/million from April 4. The engine applies date rules and rejects non-2026 IBKR estimates rather than extrapolating silently.


## Orders, reversals and monthly volume

Each simulated fill is a separate fully executed order. A reversal closes then opens, incurring two minimums. Partial fills, modifications and multi-day orders are absent. Tiered shares accumulate chronologically across all symbols and both sides; orders crossing thresholds use marginal brackets. Calendar months reset. Orders hitting the 1% cap do not count toward tier volume. Prior first-month account volume is editable and defaults to zero; later months exclude outside trading. Testing only part of a month can therefore change tiered fees.


## Venue costs cannot be inferred from minute bars

The $0.003/share default is IBKR's published NASDAQ/Island liquidity-removal rate for shares priced at least $1. It is a cost scenario, not an inferred execution venue. Venues, maker rebates, close auctions and direct API routing can differ. No rebates are assumed. Fixed does not add venue or clearing charges twice. Tiered remains explicitly an estimate.


## Small charges and rounding

The simulator rounds broker commission to cents, rounds SEC and TAF up to cents per order, retains precision for CAT, clearing, venue and pass-through fees, then rounds the total to cents. The panel exposes the rounding adjustment. This is a reproducible estimate, not verified IBKR statement aggregation or rounding. Calibrate against statements, especially for many small orders.


## Conflicting evidence and remaining uncertainty

IBKR's example page still shows zero SEC and an $8.30 TAF cap, inconsistent with the newer schedule and dated 2026 FINRA rules. We use the dated regulator sources and main schedule. Broker, CAT, clearing and pass-through rates use the review-date snapshot; a complete historical schedule archive was not obtained. This is historical trades under a fee estimate, not an exact historical statement reconstruction. SEC charge dates differ from trade/settlement dates; trade date is an approximation here. The current 90-day sample does not cross the April boundary.


## Excluded costs and execution constraints

Stock borrow fees and availability, margin/cash interest, FX conversion, market data, ADR/corporate-action fees, entity-specific taxes and intermediary markups are absent. Slippage is separate; spreads, queueing, participation limits and market impact are absent. Lower fees do not establish live profitability. No live orders are sent.


## Team review focus


- Confirm entity, IBKR Pro pricing plan and SmartRouting.
- Compare Fixed, Tiered and custom costs on identical data and dates.
- Check small regulatory fees, reversal orders and rounding against statements.
- Add borrow and capital constraints before judging live feasibility.

- [IBKR US commissions](https://www.interactivebrokers.com/en/pricing/commissions-stocks.php)
- [IBKR Hong Kong: US stocks](https://www.interactivebrokers.com.hk/en/pricing/commissions-stocks.php)
- [SEC 2026 Section 31 advisory](https://www.sec.gov/rules-regulations/fee-rate-advisories/2026-2)
- [FINRA Jan–Sep 2026 rule](https://www.finra.org/rules-guidance/rulebooks/corporate-organization/section-1-member-regulatory-fees?version=2009531)
- [FINRA Oct–Dec 2026 rule](https://www.finra.org/rules-guidance/rulebooks/corporate-organization/section-1-member-regulatory-fees?version=2009541)
- [IBKR NASDAQ / Island venue schedule](https://www.interactivebrokers.com/en/accounts/fees/INETstkfee.php?nhf=T)
- [IBKR tiered examples (outdated regulatory numbers)](https://www.interactivebrokers.com/en/accounts/fees/stocksPricing2.php?nhf=T)

## Replayed 90-day comparison

Identical 2026-06-23–2026-10-28 data and signals: 3,692 orders, 28 traded symbols, gross price P&L −US$12.23 and assumed slippage US$1,859.85.

| Model | Transaction fees | Net P&L |
|---|---:|---:|
| Legacy custom $1/order | $3,692.00 | −$5,564.08 |
| IBKR Pro Fixed estimate | $3,756.84 | −$5,628.92 |
| IBKR Pro Tiered estimate | $1,481.40 | −$3,353.48 |

Tiered assumes $0.003/share venue costs, no rebates and zero preceding first-month volume. IBKR aggregates eligible US and Canadian stock/ETF share volume; this replay only knows its own US orders plus the initial-volume input. Lower costs do not turn this sample profitable. All per-fill signed cash flows reconcile to net P&L, with zero closing positions.

The period simulator defaults to IBKR Fixed. The legacy single-day review workspace retains its explicitly labeled custom costs. Its original cost assumption A18 now points to the period simulator for IBKR models.
