# mb2sos — Movebank → Science on a Sphere

A zero-setup, browser-based tool for undergraduate biology students to turn Movebank animal
movement data into QGIS-ready, NOAA Science on a Sphere (SOS) hand-off packages.

## What it does

1. **Get data** — upload a Movebank CSV/GeoJSON export, search Movebank directly (best-effort,
   with a Data Use Agreement gate), or load one of the real sample datasets bundled in
   `static/samples/`.
2. **Map & time-lapse** — animate 2D trajectories on a Leaflet map (OSM / Esri Satellite / Esri
   Ocean basemaps) with play/pause, speed multiplier, a chronological scrubber, and trail modes
   (full trajectory, fading tail, current position only), plus a live metrics HUD.
3. **SOS studio** — render a 2:1 Plate Carrée (EPSG:4326) canvas animation with selectable global
   basemaps (OpenStreetMap, Esri World Imagery, Esri Ocean Basemap) matching what Science
   on a Sphere projects, and record it to a video file in-browser (`MediaRecorder`).
4. **QGIS hand-off** — export `epsg4326_telemetry.geojson`, `movebank_sos_ready.csv`, and a
   `README_SOS_Hand-off.txt` metadata summary, individually or bundled as a ZIP.

All data processing happens client-side in the browser; the only server-side code is a thin
proxy (`src/routes/api/movebank/*`) that forwards requests to Movebank's API to work around CORS.

## Developing

Install dependencies and start a dev server:

```sh
pnpm install
pnpm dev

# or start the server and open the app in a new browser tab
pnpm dev -- --open
```

## Building & type-checking

```sh
pnpm check   # svelte-check (TypeScript + Svelte diagnostics)
pnpm build   # production build via @sveltejs/adapter-vercel
pnpm preview # preview the production build locally
```

## Adding sample datasets

The "Or load a real Movebank dataset on file" list on the Get Data step is generated from
whatever CSV files are in `static/samples/` — there are no hardcoded datasets to edit.

1. Download a real study export from [movebank.org](https://www.movebank.org) (CSV format) and
   drop the file into `static/samples/`. Keep Movebank's original column headers
   (`timestamp`, `location-lat`, `location-long`, `individual-local-identifier`,
   `individual-taxon-canonical-name`, etc.) — the parser in `src/lib/parse.ts` relies on them.
2. Regenerate the manifest the UI reads from:

   ```sh
   pnpm samples:manifest
   ```

   (This also runs automatically as part of `pnpm dev` and `pnpm build`.)

3. The script sniffs each CSV's header and first data row to fill in a label (from
   `study-name`, falling back to the filename) and species (from
   `individual-taxon-canonical-name`). Commit both the new CSV and the updated
   `static/samples/manifest.json`.

Only use real downloaded data here — no synthetic/placeholder tracks.

## Deploying to Vercel

This project uses `@sveltejs/adapter-vercel` (see [svelte.config.js](svelte.config.js)), so it
deploys to [Vercel](https://vercel.com) with zero extra configuration:

```sh
pnpm dlx vercel
```

or connect the repository in the Vercel dashboard and it will build with `pnpm build`
automatically.
