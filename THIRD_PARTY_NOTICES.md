# Third-party notices and source availability

The browser bundles are pinned, unmodified copies of the listed package distributions. Their license notices must remain with redistributed copies. Application source is included in this repository; corresponding upstream dependency sources are linked to immutable commits below.

| Component | Version | License | Corresponding source |
| --- | --- | --- | --- |
| `@luxalgo/vela-pinets` | 0.2.13 | AGPL-3.0-only | [Vela-pinets at a2a2097](https://github.com/LuxAlgo/Vela-pinets/tree/a2a2097be8f30b4b596b13212ed4608c36c2ea26) |
| `pinets` | 0.10.0 | AGPL-3.0-only | [PineTS at 1f65fa2](https://github.com/LuxAlgo/PineTS/tree/1f65fa2dc1d46a9b254163599030f4bc27580922) |
| `@luxalgo/vela` | 0.7.7 | Apache-2.0 | [Vela at 07c1d82](https://github.com/LuxAlgo/Vela/tree/07c1d829c66bd5fb72b4ab7d2ca780d506d8a00b) |
| MSF Context 11.4.0 indicator and companion strategy | frozen 11.4.0 | MPL-2.0 | Included editable Pine files under `strategy/` |

The exact upstream commits were obtained from the npm registry metadata for the pinned package versions. The runtime bundle may embed PineTS; its separate AGPL license remains applicable. Dependency license texts accompany the vendor files. The full AGPL-3.0 and MPL-2.0 license texts also appear at the repository root.

The frozen Pine files' original license comments are retained. The scanner's audited context reference and its browser adaptation are source-visible; names such as “liquidity” or “probability” must not be inferred from ordinary candle-derived price references. No clustered support/resistance implementation from earlier experimental versions is included in the current frozen strategy.

The prefilled instrument list is editable application configuration, not a claim of platform eligibility. Binance data is retrieved directly by each visitor; no private exchange account data, hosted historical market archive, or company branding asset is redistributed by this project.

## Interface dependencies

The React interface uses shadcn/ui (MIT, adapted official new-york-v4 registry components), React and React DOM (MIT), Tailwind CSS (MIT), Motion (MIT), Radix UI (MIT), Lucide (ISC), class-variance-authority (Apache-2.0), clsx (MIT), tailwind-merge (MIT), and tw-animate-css (MIT). Exact versions and transitive dependencies are pinned in `pnpm-lock.yaml`. License texts are retained in `licenses/`. Vite and its plugins are build-time dependencies only.
