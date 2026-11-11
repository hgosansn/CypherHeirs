# Cached history and live updates

Cypher Heirs stays a static, client-side application. REST downloads, WebSocket reception, storage and confirmed Pine analysis run in the browser. No account key, proxy or hosted scanner is introduced.

## Lifecycle

1. Load the saved workspace, report and preferences before waiting for exchange metadata.
2. Verify contract metadata from a shared six-hour cache; refresh it when expired or when a full rebuild is requested.
3. Ask Binance for its clock, then download only the confirmed history missing from each instrument/timeframe cache. Fetch at most four instruments concurrently.
4. Use cached analysis only when its input fingerprint and result checksum match. Changed inputs run the complete frozen Pine indicator again, serially in a persistent worker.
5. Save the confirmed result and keep one shared live connection for the browser workspace. Live quotes never replace confirmed prices in the attention calculation.

## Candle cache and correctness

Cache keys contain the exact exchange symbol, interval and rolling-window size. Entries retain source identity, validated closed candles, a checksum of the result and an analysis input fingerprint. The fingerprint covers the Pine source hash, numerical OHLCV bars, symbol, interval minutes, scale and analysis parameters, plus the versioned `analysis-v1` adapter contract. Changes to calculation semantics must invalidate that adapter contract.

The previous normal REST request retrieved 1,000 rows including the forming candle. The cache now uses a canonical **up to 999 completed bars**. Previously, a request could occasionally contain 1,000 completed bars if the new forming bar had not yet appeared. Fixing the confirmed window avoids that intrabar-dependent history shift; old snapshots from that edge case are not claimed identical. The Pine rules and paper-forward cohort remain unchanged. Incremental downloads are merged, deduplicated by candle opening time, sorted and trimmed to that same window. Cold and updated inputs must match a fresh request for the same cutoff. Imported packages keep their supplied completed history and never populate the exchange cache.

A REST catch-up includes one overlapping closed candle. Invalid cache identity, malformed bars, large gaps or unrepaired discontinuities trigger an authoritative full-window download. A missed WebSocket interval is repaired through REST instead of being filled with synthetic candles. An unchanged window needs no candle request; confirmed provider history is treated as stable until the next overlap verification or an explicit full rebuild.

The advanced **Rebuild full history** control bypasses candle/result and metadata reuse. It is useful for reconciliation or an explicit cold-versus-warm comparison. Raw candle evidence and the input/source hashes remain included in report exports.

## Live data with a smaller payload

One combined **USD-M `/market` WebSocket** subscribes to mini-tickers for the scanned markets. Binance currently documents a two-second mini-ticker cadence. Only the currently inspected chart gets the heavier kline stream, documented at up to 250 ms when updates exist. The mini-ticker is used solely for last price; its rolling 24-hour OHLC values are never treated as chart candles.

The chart labels an outlined forming candle **FORMING PREVIEW · NOT SCORED**. Its freshness is tracked separately from the last-price quote. Only a validated kline event with `x: true` can enter the closed-candle queue. Repeated final events are consumed once; late forming events cannot replace a finalized candle.

A final event schedules a debounced universe refresh. Other instruments download only their missing closes. A 15-second watchdog catches missed close events, resume gaps and partial failures. Every changed instrument still receives a full Pine replay; incremental Pine execution is deliberately deferred.

## Tabs, failures and limits

- Web Locks permit one live owner and one scan at a time per browser origin. Other tabs receive quotes and completed report notifications through BroadcastChannel. The most recently saved report is the shared workspace snapshot, including its explicit partial-universe marker.
- Hidden tabs release their live connection; an eligible visible tab can take over. Resume/online/reconnect initiates catch-up. A scan already in progress may finish while hidden or after Live watch is switched off. Closed or suspended browsers cannot provide continuous monitoring.
- Browsers without Web Locks/BroadcastChannel retain manual scans but do not start the shared live mode.
- Subscription changes are debounced. Connections reconnect with exponential backoff/jitter and rotate before Binance's 24-hour lifetime. Disconnects do not turn old quotes into fresh prices.
- A shared local REST budget is conservatively capped at 600 weight/minute, or half a lower exchange-advertised one-minute budget. Binance's reported used-weight header is consulted when browser CORS makes it readable. Other applications or users behind the same public IP are outside this local counter.
- HTTP 429/418 pauses new requests, persists the cooldown across tabs and respects `Retry-After` when readable. Fallback waits are 60 seconds for 429 and 15 minutes for 418. Existing results remain visible. Automatic failures back off; there is no IP/key rotation or bypass.
- If persistent storage fails, the worker retains an in-memory budget/cooldown and warns that scans may not survive reload. Persistence and cross-tab guarantees depend on browser support and available storage.

## Efficiency measurements

Expand **Scan efficiency** to see worker elapsed time, REST request count, returned candle rows, decoded response bytes, request weight, cache/result reuse and full-replay time. Stream JSON payload bytes are shown separately for the live session. These counters exclude HTTP/TLS overhead and static application downloads, so they must not be described as total wire usage.

A real BTC/ETH/SOL hourly comparison on 11 November 2026, on the same local browser/device:

| Mode | Worker time | REST requests | REST response body data | Candle rows | Full Pine replays |
| --- | ---: | ---: | ---: | ---: | ---: |
| Forced complete rebuild, including metadata | 6.55 s | 5 | 1.53 MB displayed | 3,000 | 3 |
| Repeat, unchanged confirmed window | 0.35 s | 1 | 28 bytes | 0 | 0 |

A full-universe test also completed across all **66 available markets**. With three caches already populated, filling the remaining history took 121.00 seconds, 64 REST requests and 8.37 MB of response bodies. Repeating the unchanged window reused all 66 analyses in 1.40 seconds, with one 28-byte clock response and zero candle downloads.

At the actual **16:00 Europe/Paris candle close**, the live event automatically refreshed all 66 markets. It used 65 small candle requests plus the clock request, 185 returned rows and **24,952 REST body bytes**; the focused symbol reused its finalized WebSocket candle. Full Pine replay took 123.65 seconds; total worker time was 133.84 seconds. The report became current after that replay and was shared with the other tab. This confirms reduced download cost, not instantaneous full-universe Pine execution.

All 66 exported candle windows passed closed-time, length and SHA-256 evidence checks. BTC, ETH and SOL windows were then compared with fresh authoritative REST responses for the same cutoff and independently replayed through the bundled Pine engine. OHLCV and timing matched exactly; numerical result comparisons used absolute 1e-9 tolerance, with exact level identities and signal fields.

The three-market unchanged-window example was about **95% faster**. It is a cold-versus-warm comparison within the new implementation, not a measurement of the old serial implementation. Values are illustrative, not latency guarantees. New closed candles still incur full-replay cost. Live mode also adds continuous streaming traffic; turn it off when only periodic scans are needed.

The deterministic fixture test compares 84,001 body bytes for a full 1,000-row response with 253 bytes for a three-row catch-up: 99.70% fewer candle-response bytes. This is a synthetic transfer-size check, not a live exchange bandwidth measurement.

## Validation and source

`pnpm test` covers cold/delta/stream candle-window equality, overlap deduplication, gaps, invalid/future candles, metadata reuse, HTTP cooldown sharing, concurrency bounds, final-event deduplication, focus subscription changes and reconnect teardown. Existing frozen-Pine identity, indicator/strategy parity and prefix tests remain required. Actual browser checks cover live Binance quotes, a forming chart preview, cache reuse and multiple-tab coordination. These checks do not validate profitability or native TradingView delivery.

Implementation: [candle cache](../lib/candle-cache.mjs), [network guard](../lib/network.mjs), [live transport](../lib/live-feed.mjs), [browser coordinator](../client.mjs), [scanner worker](../scanner-worker.js), [pipeline contracts](../tests/data-pipeline.mjs).

Official Binance references: [REST market data](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data), [market streams](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/market), [connection rules](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/websocket-market-streams/Connect), [rate-limit guidance](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info).

[Documentation index](README.md) · [User guide](user-guide.md)
