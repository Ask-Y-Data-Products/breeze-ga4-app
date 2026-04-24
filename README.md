# Breeze GA4 Analytics — Web App

Web replacement for the Breeze GA4 Claude Code plugin. Built on the Asky data backend (DuckDB over uploaded parquet).

## Stack
- **Vite + React 18 + TypeScript**
- **Tailwind CSS v4** (dark theme)
- **Apache ECharts** for charts
- **TanStack Query** for fetching/caching, **TanStack Table** for tables
- **Zustand** for filter state
- **React Router** for in-app navigation

## Pages (mapped to plugin skills)

| Page | Plugin equivalent | What it does |
|---|---|---|
| Executive | (cross-cutting) | KPI cards + channel/device/country breakdowns, with anomaly banner |
| Experiments | `ga4-stats` | Variation comparison, sample-size split, channel/device mix per arm, contamination check |
| Explore | `ga4-query` | Deterministic GUI: pick filters + group-by + metric → server-validated SQL |
| Learn | `ga4-learn` | Schema browser for all GA4 tables (available + planned), grouped by domain |
| Data Quality | (gap from call) | Anomaly catalog + NULL/bot coverage panel — visible to every consumer |
| Settings | `ga4-setup` | Mode auto-detect, token entry, one-click connection test |

## Auth modes (auto-detected)

The app calls `detectMode()` at runtime:

- **Deployed mode** — when served from `*askycore*` / `*asky*` host. Uses `./api/...` relative URLs, relies on the browser cookie set by Asky. No token required.
- **Stage mode** — anywhere else (localhost, etc.). Hits the stage URL with `X-App-Token` header. Token is entered on the Settings page and stored in `localStorage` only.

A single build supports both — no env-var swap, no rebuild.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:5173
# go to Settings → paste your X-App-Token → Test connection
```

## Build for Asky deploy

```bash
npm run build
# dist/ now contains index.html + assets/ with relative paths
cd dist && zip -r ../ga4-app-deploy.zip .
```

Then upload `ga4-app-deploy.zip` via the **Deploy Application** section of the Asky UI. The zip's contents must be at the **root** of the archive (not nested inside an extra folder) — the script above does this correctly.

## Project / data wiring

Hard-coded constants in `src/api/asky.ts`:

```ts
WORKSPACE_ID = 'ws_3acb27d1055047e3a42f296396937fa6'
PROJECT_ID   = 'd870e7aaa1eb45e5a856809322cde9f2'
```

The only currently materialized table is the GA4 Experiments view (`src/data/tables.ts`):

```
prismview_ptbl_d870e7aaa1eb45e5a856809322cde9f2_ga4_experiments_data_467183_1
```

The Learn page lists `ga4_sessions`, `ga4_events`, `ad_spend` as **planned** — when their parquet is uploaded to the Asky project, set their `status: 'available'` and update the `modelId` to the new `prismview_*` name. The pages will start using them automatically (Executive will need to switch its query to `ga4_sessions` for true session-level KPIs).

## Caveats

- Bundle is ~1.4 MB (445 KB gz), dominated by ECharts. Code-split if it matters.
- No date-range UI yet beyond the From/To pickers — they're capped to 2025-12-31 / 2026-01-01 because that's the loaded data window.
- `ga4-feedback` skill is not implemented as a page — link out to a team channel from Settings instead.
- Filter state lives only in memory; no URL serialization yet (so a filtered view isn't shareable as a link).
- Stats math (chi-square, power, BH correction) is not yet ported from the plugin's Python scripts.

## Files

```
src/
  api/asky.ts            — fetch wrapper, mode detection, token storage
  state/store.ts         — Zustand filter store + buildWhere() SQL helper
  data/tables.ts         — table catalog (available + planned)
  data/schema.ts         — column docs for the experiments table (drives Learn)
  data/anomalies.ts      — data-quality anomaly catalog (drives banner + DQ page)
  components/            — Layout, Card/KPICard, Chart (Bar/Donut/Line/Stacked),
                           DataTable, FilterBar, AnomalyBanner, QueryState
  pages/                 — Executive, Experiments, Explore, Learn, DataQuality, Settings
  styles/index.css       — Tailwind v4 + theme tokens
```
