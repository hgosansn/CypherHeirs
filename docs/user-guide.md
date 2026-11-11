# User guide

Open [Cypher Heirs](https://hgosansn.github.io/CypherHeirs/), select **Open dashboard**, then **Run fresh scan**. You can also bookmark the [dashboard directly](https://hgosansn.github.io/CypherHeirs/dashboard.html). Keep the tab open while its background worker processes the available markets. Search and filter the table, pin markets locally, select a market to inspect its candle chart, and open the methodology panel to see the attention arithmetic. Browser-local storage belongs to the current browser and origin; it does not synchronize between devices.

Open the separate **Assets** tab to review and edit the prefilled asset list. The list is a starting configuration, not a claim that an instrument is tradable on any particular platform. Asset names are fixed. The tab checks active Binance USDT perpetual contracts and filters unavailable assets automatically. Save your list locally before scanning it.

### Controls

- **Dashboard:** run a fresh scan, search or sort markets, filter attention states, pin markets, inspect candles and named levels, export a report, or import a candle package.
- **Assets:** choose an available Binance asset from the add selector, enable or disable inclusion, remove it with the red × button, search the list, and save the draft. Symbols are read-only and no category is required. At least one asset must remain enabled.
- **Restore starter list:** restores the editable draft; select **Save assets** to apply it.

Saved asset changes apply to the **next scan**. They do not rewrite the preceding report; the dashboard identifies a changed list until a new scan uses it. Saving is blocked while a scan is running. Asset configuration and pinned markets persist only in the current browser and site origin.

The static files can also be served locally with any ordinary static HTTP server. Opening `index.html` directly with a `file:` URL is not supported because workers, modules, and fetches require an HTTP origin. No dependency installation or server-side runtime is required to host the published files.

## Analysis studio

Open **Analysis studio** to choose which levels and entry types contribute to attention. Change the draft, inspect its live preview, then select **Apply rules** to save and update the radar. Leaving the studio discards an unapplied draft. **Defaults** restores a draft; it still needs Apply. Export/import a rules JSON file to reuse preferences in another browser.

Every market inspector shows its score breakdown. Select a reference to locate it on the candle chart; expand its explanation for calculation and trading context. On smaller screens the inspector opens in a sheet.

The [attention engine guide](attention-engine.md) explains weights, formulas, source selection and what the switches change.

## A useful daily routine

Refresh the scan, review the priority queue, inspect why a market ranks, then pin markets you want to follow. Treat levels as places to observe, not immediate instructions to trade. An exported report is a dated snapshot; refreshing it requires an open browser and a new scan.

## Access problems

If Binance requests fail or candles are outdated, the app shows that state. It cannot override regional or network restrictions. Keep the last report for reference or use a correctly sourced candle import; see [data and privacy](data-and-privacy.md).


---
[Documentation index](README.md) · [Product overview](../README.md) · [Open Cypher Heirs](https://hgosansn.github.io/CypherHeirs/)
