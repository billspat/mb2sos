<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import {
		buildGeoJson,
		buildCsv,
		buildReadme,
		downloadTextFile,
		downloadZipBundle
	} from '$lib/export';

	const dataset = $derived(appState.dataset);
	const summary = $derived(appState.summary);

	let zipping = $state(false);

	function downloadGeoJson() {
		if (!dataset) return;
		downloadTextFile('epsg4326_telemetry.geojson', buildGeoJson(dataset), 'application/geo+json');
	}

	function downloadCsv() {
		if (!dataset) return;
		downloadTextFile('movebank_sos_ready.csv', buildCsv(dataset), 'text/csv');
	}

	function downloadReadme() {
		if (!dataset) return;
		downloadTextFile('README_SOS_Hand-off.txt', buildReadme(dataset), 'text/plain');
	}

	async function downloadZip() {
		if (!dataset) return;
		zipping = true;
		try {
			await downloadZipBundle(dataset);
		} finally {
			zipping = false;
		}
	}

	function formatDate(ms: number): string {
		return new Date(ms).toISOString().slice(0, 10);
	}
</script>

<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
	<h2 class="text-lg font-semibold text-slate-100">QGIS hand-off package</h2>
	<p class="mt-1 text-sm text-slate-400">
		Everything the SOS/QGIS operator needs: a GeoJSON layer, a flat CSV, and a plain-text metadata
		summary — all in WGS 84 (EPSG:4326).
	</p>

	{#if !dataset || !summary}
		<p class="mt-2 text-sm text-slate-400">
			Load a dataset first to generate the hand-off package.
		</p>
	{:else}
		<dl class="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
			<div class="rounded-lg bg-slate-900/60 p-3">
				<dt class="text-xs tracking-wide text-slate-500 uppercase">Species</dt>
				<dd class="text-slate-100">{dataset.species}</dd>
			</div>
			<div class="rounded-lg bg-slate-900/60 p-3">
				<dt class="text-xs tracking-wide text-slate-500 uppercase">Individuals</dt>
				<dd class="text-slate-100">{summary.individualIds.length}</dd>
			</div>
			<div class="rounded-lg bg-slate-900/60 p-3">
				<dt class="text-xs tracking-wide text-slate-500 uppercase">Date range</dt>
				<dd class="text-slate-100">{formatDate(summary.startMs)} – {formatDate(summary.endMs)}</dd>
			</div>
			<div class="rounded-lg bg-slate-900/60 p-3">
				<dt class="text-xs tracking-wide text-slate-500 uppercase">Bounding box</dt>
				<dd class="text-slate-100">
					{summary.minLat.toFixed(1)}, {summary.minLon.toFixed(1)} to {summary.maxLat.toFixed(1)}, {summary.maxLon.toFixed(
						1
					)}
				</dd>
			</div>
		</dl>

		<div class="mt-5 flex flex-wrap gap-2">
			<button
				type="button"
				onclick={downloadGeoJson}
				class="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-sky-400 hover:text-sky-300"
			>
				Download GeoJSON
			</button>
			<button
				type="button"
				onclick={downloadCsv}
				class="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-sky-400 hover:text-sky-300"
			>
				Download CSV
			</button>
			<button
				type="button"
				onclick={downloadReadme}
				class="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-sky-400 hover:text-sky-300"
			>
				Download README
			</button>
			<button
				type="button"
				onclick={downloadZip}
				disabled={zipping}
				class="rounded-md bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
			>
				{zipping ? 'Zipping…' : 'Download all as ZIP'}
			</button>
		</div>

		<div class="mt-5 rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
			<p class="font-medium text-slate-200">For the SOS coordinator:</p>
			<ul class="mt-2 list-inside list-disc space-y-1">
				<li>
					Layer Coordinate Reference System: <span class="font-mono">EPSG:4326 — WGS 84</span>
				</li>
				<li>
					Enable QGIS Temporal Controller using the <span class="font-mono">timestamp</span> field
				</li>
				<li>
					Data covers {summary.individualIds.length} individual(s), {summary.totalPoints} points
				</li>
			</ul>
		</div>
	{/if}
</section>
