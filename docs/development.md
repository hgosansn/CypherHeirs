# Development and deployment

This repository contains only the standalone application, its frozen strategy sources, pinned browser dependencies, and license notices. It excludes private research ledgers, candle archives, local machine paths, credentials, workspace history, and runtime reports.

The included GitHub Actions workflow tests and deploys static files from `main`. In **Settings → Pages**, select **GitHub Actions** as the publishing source. Pushes to `main` or a manual workflow run then install pinned dependencies, run `pnpm test` on Node 24, build the UI, and deploy `dist/`. Contract tests generate synthetic candles in memory and check the included Pine runtime; they do not download or publish market history. The deployment does not fetch live market data or run an unattended trading strategy.

For development, use Node 24 and pnpm 11.25.0: run `pnpm install --frozen-lockfile`, then `pnpm dev`. Run `pnpm test` for offline scanner contracts and `pnpm build` for the deployable `dist/` directory. The UI uses React, official shadcn/ui components, Tailwind CSS, and Motion. Only the build needs Node; deployed analysis still runs entirely in the visitor's browser. Live network access and actual GitHub Pages browser behavior are separate checks.

## Development commands

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm preview
```

The dev server uses `http://127.0.0.1:8792/`. Production output is `dist/`; serve it over HTTP. The public landing page is `index.html`; the app is `dashboard.html`. Vite builds separate entries, so opening the landing page does not initialize the scanner or request market data. Legacy root links with a `symbols` query redirect to the dashboard with their query preserved. Both pages keep the same browser origin and saved workspace. Vite uses a relative base so project-path hosting works on GitHub Pages. `scripts/runtime.mjs` copies the classic worker, scanner modules, frozen strategy and license notices into generated static output. Keep those files together.

## Validation

`pnpm test` checks editable attention profiles, component/source toggles, weighting, no stacking, decay, freshness, invalid inputs and evidence preservation. Scanner contracts also test period completeness, mapping, asset validation, immutable Pine identity, browser-bundle indicator/strategy parity and prefix stability. Synthetic checks do not establish live data access, native TradingView behavior or profitability.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/` | React UI and shadcn/ui components |
| `lib/` | Source calculations, attention rules and asset mappings |
| `client.mjs` | Browser settings, cross-tab ownership, live quotes and scan coordination |
| `scanner-worker.js` | Bounded downloads, validated candle cache and full Pine execution |
| `strategy/` | Preserved Pine indicator and companion strategy |
| `vendor/`, `licenses/` | Pinned scanner bundles and license notices |
| `tests/` | Offline contracts |
| `docs/` | Product guides and promotional assets |
| `.github/workflows/pages.yml` | Test, build and Pages deployment |

`node_modules/`, `.runtime-static/` and `dist/` are generated and ignored. Never put secrets in browser code or public configuration.

## Release process

Run checks and the production build, update the [changelog](CHANGELOG.md), commit and push to `main`, and wait for Pages verification. Create an annotated version tag on that tested commit, then publish a GitHub Release with the matching changelog notes. The README release badge links to the latest published release. The hosted app remains the primary distribution; source snapshots are available from GitHub Releases.




The [data pipeline guide](data-pipeline.md) documents cache fingerprints, live transport, cross-tab coordination and performance checks. Storage uses the existing IndexedDB database without discarding workspace keys.

---
[Documentation index](README.md) · [Product overview](../README.md) · [Open Cypher Heirs](https://hgosansn.github.io/CypherHeirs/)
