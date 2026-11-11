# Data, imports and privacy

## Data and calculation boundaries

- The feed is Binance USD-M USDT perpetual **last-trade candles**. Prices reflect that exchange's contracts, rather than another platform's executable bid/ask feed.
- Only completed candles enter the analysis. The forming bar is excluded using the exchange clock.
- The actual frozen MSF Context 11.4.0 indicator runs through the bundled PineTS engine. The companion Pine strategy is preserved for inspection. Browser success is not native TradingView verification.
- Context includes prior complete UTC day/week highs and lows, weekly open, completed opening-window ranges, weekly VWAP bands, and confirmed structure. Missing coverage must not become a fabricated level. The half-hour-aligned New York opening range is unavailable from the hourly feed.
- Recent LONG/SHORT events are independent indicator signals. Fills, position occupancy, execution costs, funding, and subsequent live stop management are not simulated by the dashboard.
- A rolling candle window can differ from a chart that has run continuously over a longer history. Broader market coverage does not extend or modify the separately frozen paper-forward cohort.
- The asset universe is browser-local configuration. Adding a label does not establish a valid data mapping; unavailable instruments remain explicit coverage gaps. Verify the exchange contract identity and unit scale before relying on a newly added asset.

Assets without an exact active Binance USDT perpetual contract are filtered out before analysis; no category or substitute feed is used. The initial list can be changed without changing the frozen indicator or its paper-forward research cohort.

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



## Live and cached data

Confirmed candles and checked analysis results are retained locally by instrument/timeframe. Repeated scans fetch missing data rather than downloading the entire window. A separate Binance WebSocket provides unconfirmed prices and the selected chart's forming candle; these values do not enter confirmed attention ratings. The feed pauses in hidden tabs and never runs for imported replays. One connection is coordinated across tabs of the same origin. See [cached history and live updates](data-pipeline.md) for integrity, rate-limit handling and byte-counter definitions.

---
[Documentation index](README.md) · [Product overview](../README.md) · [Open Cypher Heirs](https://hgosansn.github.io/CypherHeirs/)
