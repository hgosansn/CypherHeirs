# Attention engine

Open **Analysis studio** to configure four score components, 16 named level sources and four R/C LONG/SHORT entry types. Each source has an enable switch, an importance multiplier (0–100%), a calculation explanation and an observation/trading contract. Scoring controls set maximum points, ATR radii, the approach comparison (1–24 bars), entry lookback (1–24 hours), and Focus/Watch/Observe thresholds.

The default component weights are proximity 60, approach 15, touch 10 and confirmed entry 15. For each enabled available level, compute:

- Proximity: round(weight × max(0, 1 − ATR distance / proximity radius) × level importance).
- Approach: round(weight × level importance) if within the near radius and closer than N completed bars ago to the same current reference; otherwise zero.
- Touch: round(weight × level importance) if the last completed candle intersects the level and the close remains inside the near radius; otherwise zero.

Select the **strongest total level contribution**, with distance then source ID as deterministic tie breaks. This replaces v1's nearest-only selection. Separately choose the strongest enabled R/C direction event: round(entry weight × max(0, 1 − age hours / lookback hours) × entry importance). Sum that level's three rounded components and the selected event. Cap at 100. No stacking coincident levels, no stacking repeated entries, no hidden normalization or redistribution when a rule is disabled. Zero weights contribute zero. The actual nearest enabled reference remains available independently of the selected scoring reference.

The draft preview and each market inspector show the source, weight, observed factor, importance and points. Displayed factors are rounded for readability; exported reports contain the full factors. Invalid thresholds block application. **Apply rules** saves a versioned, validated browser-local profile in IndexedDB and recalculates the existing snapshot without network requests or Pine re-execution. Export/import rules supports portable JSON profiles; report exports include the active profile, rating contract and breakdowns. Defaults restores a draft, requiring Apply. Unsaved drafts are discarded when leaving the studio. Settings never make stale data current.

Level switches affect scored/displayed references and level filters. Entry switches affect selected events and the Signals filter; switching the confirmed-entry scoring component off also excludes those events from that filter. Other component switches change points only. Raw levels, raw emitted events, candle evidence and the frozen Pine source are preserved. RSI, EMA and structural context do not secretly add points. Disabling a level does **not** recompute Pine entries with a different setup lifecycle; entry events retain the original complete source inventory. This is an editable discretionary attention layer, not an editable execution strategy or a new forward cohort.

Level playbooks explain rejection/reclaim or acceptance/retest ideas as discretionary observations, not new detected entry families. Actual R/C entries require the frozen prior-known level, contained opening-window reaction, intact reaction extreme and strictly later confirmed 4/4 pivot break. Confirmation close is a reference; the next eligible execution is afterward. No automatic target, fills, costs or post-entry trailing are simulated. The Engine contract tab documents timing, coverage, fixed calculations and source identity with links to both Pine files. General educational context: [CME support and resistance](https://www.cmegroup.com/education/courses/technical-analysis/support-and-resistance); the exact implementation is defined by the included source, not that educational material.

These weights and thresholds are unvalidated attention preferences, not probabilities or expected returns. Changing the dashboard does not validate an edge.

## Reading the engine

The in-app **Engine contract** tab explains source clocks, complete-period checks, ATR normalization, confirmed pivots and the frozen Pine setup lifecycle. Read the source in [`lib/rules.mjs`](../lib/rules.mjs), [`lib/attention.mjs`](../lib/attention.mjs), [`lib/reference.mjs`](../lib/reference.mjs) and [`strategy/indicator.pine`](../strategy/indicator.pine). The [companion strategy](../strategy/strategy.pine) is supplied for inspection; native TradingView and live delivery are separate verification boundaries.


---
[Documentation index](README.md) · [Product overview](../README.md) · [Open Cypher Heirs](https://hgosansn.github.io/CypherHeirs/)
