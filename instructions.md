# A simple JS app to convert Movebank to Science on a Sphere (SoS)

## About you

You are a svelte/sveltekit JS expert developer, and you know how to make apps that undergraduate students will enjoy.
You are an expert at cartography, moving making and data formats.

## Target Audience & Goal

Build a zero-setup, web-based tool for undergraduate biology students with no prior GIS, coding, or data science experience. The application lets students search Movebank for mammal movement data, animate 2D trajectories over time on interactive maps, export QGIS-ready files tailored for NOAA Science on a Sphere (SOS) in EPSG:4326 (Plate Carrée), and generate a 2:1 aspect ratio preview video directly in the browser.

They will identify data sets on MoveBank that they can download (somehow) with a species of interest. They will download
these, agreeing to data use agreements (somehow). this app serves primarily as a conversion and visualization tool to

1. see what's in the data and 2) create a file (or package) they can give to the manager of our local Science on a Sphere
   coordinator who uses QGIS to create SoS visualizations.

If possible, find a way to download data directly from movebank inside this app. This has proven difficult because there
just isn't that much public data in this systems. Searching on particular species has come up empty or not download-able

---

## Tech Stack & Architectural Guidelines

### 1. Framework: SvelteKit + Svelte 5

- Follow current Svelte & SvelteKit idioms (`https://svelte.dev/docs/llms` and `https://mcp.svelte.dev/mcp`).
- Use **Svelte 5 reactivity primitives (Runes)**: `$state()`, `$derived()`, `$effect()`, and `$props()`.
- Keep component structures modular and lightweight.
- Fully compatible with deployment on **Vercel** (zero-config SvelteKit adapter `@sveltejs/adapter-vercel` or adapter-auto).

### 2. Styling & UI: Modern and simple

- **Theme:** Use modern theming, either Tailwind or steal CSS from https://dxstudio.msu.edu/website-technology/web-standards This app does not have to be mobile friendly because it requires exporting and download files to give to someone else.  
  Alternatively use any modern, clean looking theme (dark or light) that is easy to navigate

### 3. Serverless API Proxy (`src/routes/api/movebank/...`)

- Movebank's REST API enforces strict CORS policies and custom header/auth rules that fail when queried directly from a browser.
- Use lightweight SvelteKit server routes (`+server.js`) running on Vercel Serverless Functions to handle fetching data from Movebank backend-to-backend.

### 4. Mapping & Spatial Engine

- **Leaflet.js** (loaded client-side inside `onMount` or via dynamic import).
- **100% Free, Keyless Basemaps Only:**
  1. OpenStreetMap Standard
  2. Esri World Imagery (Satellite)
  3. Esri Ocean Basemap (Bathymetry)
- **Coordinates & Spatial Reference:** Enforce EPSG:4326 (WGS 84 Equirectangular / Plate Carrée) standard across all exports to match Science on a Sphere requirements.

## Project Structure & File Layout

Use the recommendation/standard from SvelteKit 2+ (latest) for project struture

## Detailed Functional Requirements

### Module 0: Get Data into the conversion tool

#### Option 1 (primary option): Data upload

Create a friendly to way to upload data that has been downlaoded from movebank. This is the easiest way because
all authentication, user terms, etc are handled on Movebank.

#### Option 2: Automatic Movebank Proxy & Authentication (`/src/routes/api/movebank/`) for automatic download

*Note we've tried this and it's hard to find data this way. It would be REALLY great if there was a better way to
discover data on Movebank besides putting in a species just to find out it's not there or not download-able.

1. **Movebank User Terms & Auth Modal:**

- Prompt students to acknowledge Movebank's Data License and User Terms before downloading live datasets.
- Provide fields for optional Movebank user credentials (username/password) passed securely via Serverless headers for studies requiring basic auth.

2. **Server Route `/api/movebank/search/+server.js`:**

- Proxy requests to Movebank API: `https://www.movebank.org/movebank/service/direct-read?entity=study`.
- Filter by taxon/species name (e.g., _Panthera leo_, _Ursus maritimus_, _Loxodonta africana_, _Megaptera novaeangliae_).
- Return clean JSON array containing: `study_id`, `study_name`, `species`, `sensor_type`, `number_of_events`, and `license_type`.

3. **Server Route `/api/movebank/events/+server.js`:**

- Query event data (`entity=event&study_id=...`).
- Extract fields: `timestamp`, `location_lat`, `location_long`, `individual_local_identifier` (or `individual_id`).
- Standardize timestamps to ISO 8601 UTC.

4. **Fallback Sample Datasets:**

- If the Movebank API is slow, rate-limited, or down during a live lab, automatically provide 3 embedded sample datasets (Polar Bear, African Elephant, Humpback Whale) from `/static/samples/` so the class activity is uninterrupted.

### Module 2: Interactive 2D Map & Time-Lapse Controls (`MapPreview.svelte`)

1. **Interactive Map Display:**

- Render Leaflet map with standard Bootstrap/Tabler layer selector (OSM, Esri Satellite, Esri Ocean).
- Plot tracks color-coded by individual animal ID.

2. **Time-Lapse Controller:**

- Play / Pause button.
- Playback speed slider (e.g., 1x, 10x, 100x, 1000x time multiplier).
- Chronological timeline scrubber (Bootstrap `<input type="range">`) displaying date/time indicator.
- Visual tail modes: "Full Trajectory", "Fading Tail (Last 7/14 Days)", or "Current Position Only".

3. **Metrics HUD:**

- Real-time display showing active date/time, total individuals active, and cumulative trajectory distance in kilometers (calculated via Haversine formula).

### Module 3: Science on a Sphere (SOS) Studio (`SosStudio.svelte`)

1. **SOS 2:1 Projection Requirements:**

- NOAA Science on a Sphere strictly requires global 2:1 aspect ratio renders (e.g., 2048×1024 or 1024×512) in **Equirectangular / Plate Carrée (EPSG:4326)** projection spanning Longitude [-180°, +180°] and Latitude [-90°, +90°].

2. **HTML Canvas Renderer:**

- Render points and trajectories on an offscreen 2:1 canvas over a Plate Carrée global map background.

3. **In-Browser Video Exporter (`videoRecorder.js`):**

- Use `MediaRecorder` API to record the canvas animation loop.
- Provide a "Record SOS Preview Video" button.
- Export an MP4 / WebM video file that matches what the SOS operator will see when projected on the sphere.

### Module 4: QGIS Hand-Off Package (`QgisExporter.svelte`)

1. Generate downloadable files structured specifically for the QGIS/SOS operator:

- **`epsg4326_telemetry.geojson`**: Standard GeoJSON containing Point features with properties (`timestamp`, `individual_id`, `species`, `latitude`, `longitude`).
- **`movebank_sos_ready.csv`**: Standardized CSV file formatted for direct import into QGIS.
- **`README_SOS_Hand-off.txt`**: Auto-generated text file summarizing metadata for the QGIS manager:
- Species Name & Movebank Study ID
- Geographic Bounding Box (Min/Max Lat & Long)
- Temporal Extent (Start Date to End Date)
- Total Points & Individual Animal Count
- QGIS Settings Note: _"Layer Coordinate Reference System: EPSG:4326 - WGS 84. Enable Temporal Controller using the 'timestamp' field."_

2. Offer single-click individual downloads or a bundled ZIP export using `JSZip`.

---

## Non-Functional & Classroom Usability Requirements

- **Limit Zero GIS Jargon for Students:** The user interface should not require complex GIS terms (EPSG codes, transformations). The app handles all conversions to EPSG:4326 automatically. It should be visible on the final
  modules so the student, if asked, can answer details about the format/data/crs if asked by the coordinator

## Expected Output

This folder has the barebones Svelte latest app using npx sv create, but add Svelte 5 component files, serverless route handlers, static fallback samples, and instructions for running `npm run dev` and deploying to Vercel.
