# Cypher Heirs

A thin, neon technical dashboard for an editable asset universe. Candle downloads, the frozen Pine indicator, key-level calculations, attention rankings, and charts run in your browser. There is no application server, trading account connection, API key, order placement, or scheduled data job.

## Use

Open the GitHub Pages site and select **Run fresh scan**. Keep the tab open while its background worker processes the available markets. Search and filter the table, pin markets locally, select a market to inspect its candle chart, and open the methodology panel to see the attention arithmetic. Browser-local storage belongs to the current browser and origin; it does not synchronize between devices.

Open the separate **Assets** tab to review and edit the prefilled asset list. The list is a starting configuration, not a claim that an instrument is tradable on any particular platform. Asset names are fixed. The tab checks active Binance USDT perpetual contracts and filters unavailable assets automatically. Save your list locally before scanning it.

### Controls

- **Dashboard:** run a fresh scan, search or sort markets, filter attention states, pin markets, inspect candles and named levels, export a report, or import a candle package.
- **Assets:** choose an available Binance asset from the add selector, enable or disable inclusion, remove it with the red × button, search the list, and save the draft. Symbols are read-only and no category is required. At least one asset must remain enabled.
- **Restore starter list:** restores the editable draft; select **Save assets** to apply it.

Saved asset changes apply to the **next scan**. They do not rewrite the preceding report; the dashboard identifies a changed list until a new scan uses it. Saving is blocked while a scan is running. Asset configuration and pinned markets persist only in the current browser and site origin.

The static files can also be served locally with any ordinary static HTTP server. Opening `index.html` directly with a `file:` URL is not supported because workers, modules, and fetches require an HTTP origin. No dependency installation or server-side runtime is required to host the published files.

## Data and calculation boundaries

- The feed is Binance USD-M USDT perpetual **last-trade candles**. Prices reflect that exchange's contracts, rather than another platform's executable bid/ask feed.
- Only completed candles enter the analysis. The forming bar is excluded using the exchange clock.
- The actual frozen MSF Context 11.4.0 indicator runs through the bundled PineTS engine. The companion Pine strategy is preserved for inspection. Browser success is not native TradingView verification.
- Context includes prior complete UTC day/week highs and lows, weekly open, completed opening-window ranges, weekly VWAP bands, and confirmed structure. Missing coverage must not become a fabricated level. The half-hour-aligned New York opening range is unavailable from the hourly feed.
- Recent LONG/SHORT events are independent indicator signals. Fills, position occupancy, execution costs, funding, and subsequent live stop management are not simulated by the dashboard.
- A rolling candle window can differ from a chart that has run continuously over a longer history. Broader market coverage does not extend or modify the separately frozen paper-forward cohort.
- The asset universe is browser-local configuration. Adding a label does not establish a valid data mapping; unavailable instruments remain explicit coverage gaps. Verify the exchange contract identity and unit scale before relying on a newly added asset.

Assets without an exact active Binance USDT perpetual contract are filtered out before analysis; no category or substitute feed is used. The initial list can be changed without changing the frozen indicator or its paper-forward research cohort.

An **attention score** ranks inspection priority, not expected return or win probability: proximity contributes up to 60 points, approaching within 0.50 ATR adds 15, a last-candle touch within 0.50 ATR adds 10, and a confirmed signal contributes up to 15 with a 24-hour linear decay. These weights are unvalidated presentation choices and do not change Pine's signal gates. Outdated, missing, or failed inputs cannot receive a current rating.

## Browser access and privacy

Direct exchange requests can fail because of browser cross-origin restrictions, network policy, exchange availability, or regional restrictions. A static site cannot override those restrictions. Unavailable markets are coverage gaps, not clean technical results. The import interface accepts candle data as an explicit local fallback; imported data must retain its source and cutoff and must not be presented as a live exchange refresh.

The candle-import JSON uses the following shape (the empty array illustrates the schema, not a usable dataset):

```json
{
  "source": "Provider and export description",
  "asOf": "2026-11-11T12:00:00Z",
  "exchangeInfo": {
    "symbols": [
      {
        "symbol": "BTCUSDT",
        "baseAsset": "BTC",
        "quoteAsset": "USDT",
        "status": "TRADING",
        "contractType": "PERPETUAL"
      }
    ]
  },
  "candles": {"BTC": []}
}
```

Replace each candle array with actual Binance-format kline rows: opening timestamp in milliseconds, open, high, low, close, volume, then any remaining original fields. Include at least 250 completed bars per market; the normal scanner uses 1,000. Use configured asset labels as keys. Preserve exact metadata and scaled contract identities such as `1000PEPEUSDT`; do not relabel spot data as perpetual data. The cutoff must be a valid past timestamp and the source description must identify the data. Imports are processed locally in the worker and remain explicitly labeled imported.

The site connects directly to public data endpoints from the visitor's browser. No credentials are requested. Local pins and saved scans stay in the browser unless the visitor explicitly exports them. GitHub serves the static application; it does not perform the analysis.

## Repository and deployment

This repository contains only the standalone application, its frozen strategy sources, pinned browser dependencies, and license notices. It excludes private research ledgers, candle archives, local machine paths, credentials, workspace history, and runtime reports.

The included GitHub Actions workflow tests and deploys static files from `main`. In **Settings → Pages**, select **GitHub Actions** as the publishing source. Pushes to `main` or a manual workflow run then install pinned dependencies, run `pnpm test` on Node 24, build the UI, and deploy `dist/`. Contract tests generate synthetic candles in memory and check the included Pine runtime; they do not download or publish market history. The deployment does not fetch live market data or run an unattended trading strategy.

For development, use Node 24 and pnpm 11.25.0: run `pnpm install --frozen-lockfile`, then `pnpm dev`. Run `pnpm test` for offline scanner contracts and `pnpm build` for the deployable `dist/` directory. The UI uses React, official shadcn/ui components, Tailwind CSS, and Motion. Only the build needs Node; deployed analysis still runs entirely in the visitor's browser. Live network access and actual GitHub Pages browser behavior are separate checks.

## Licensing and provenance

Application code is available under AGPL-3.0-only; see [LICENSE](LICENSE). Pine files retain their MPL-2.0 notices; see [LICENSE-MPL-2.0.txt](LICENSE-MPL-2.0.txt). Dependencies retain their own licenses and immutable corresponding-source references in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No Binance, TradingView, or LuxAlgo affiliation or endorsement is implied.

Primary references: [Binance USD-M API documentation](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Kline-Candlestick-Data) and the included frozen strategy sources.
