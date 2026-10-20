<script lang="ts">
	import 'leaflet/dist/leaflet.css';
	import type * as Leaflet from 'leaflet';
	import { appState, type BasemapId } from '$lib/state.svelte';
	import { BASEMAPS } from '$lib/basemaps';
	import { visiblePointsAtTime, metricsAtTime, colorForIndividual } from '$lib/geo';
	import TimelineControls from './TimelineControls.svelte';

	let mapEl = $state<HTMLDivElement>();
	let map: Leaflet.Map | undefined;
	let L: typeof Leaflet | undefined;
	let layerGroup: Leaflet.LayerGroup | undefined;
	let tileLayers: Record<BasemapId, Leaflet.TileLayer> | undefined;

	const dataset = $derived(appState.dataset);
	const summary = $derived(appState.summary);
	const metrics = $derived(dataset ? metricsAtTime(dataset, appState.currentTimeMs) : null);

	$effect(() => {
		let cancelled = false;
		import('leaflet').then((mod) => {
			if (cancelled || !mapEl) return;
			L = mod.default;
			map = L.map(mapEl, { worldCopyJump: true }).setView([20, 0], 2);
			layerGroup = L.layerGroup().addTo(map);

			tileLayers = {
				osm: L.tileLayer(BASEMAPS.osm.url, { attribution: BASEMAPS.osm.attribution, maxZoom: 19 }),
				'esri-satellite': L.tileLayer(BASEMAPS['esri-satellite'].url, {
					attribution: BASEMAPS['esri-satellite'].attribution,
					maxZoom: 19
				}),
				'esri-ocean': L.tileLayer(BASEMAPS['esri-ocean'].url, {
					attribution: BASEMAPS['esri-ocean'].attribution,
					maxZoom: 13
				})
			};
			tileLayers[appState.basemap].addTo(map);

			const control = L.control.layers(
				Object.fromEntries(
					Object.entries(tileLayers).map(([id, layer]) => [BASEMAPS[id as BasemapId].label, layer])
				)
			);
			control.addTo(map);
			map.on('baselayerchange', (e: Leaflet.LayersControlEvent) => {
				const match = Object.entries(BASEMAPS).find(([, v]) => v.label === e.name);
				if (match) {
					const id = match[0] as BasemapId;
					appState.basemap = id;
					appState.sosBasemap = id;
				}
			});

			renderTracks();
			fitToData();
		});
		return () => {
			cancelled = true;
			map?.remove();
			map = undefined;
		};
	});

	function fitToData() {
		if (!map || !L || !summary) return;
		const bounds = L.latLngBounds(
			[summary.minLat, summary.minLon],
			[summary.maxLat, summary.maxLon]
		);
		if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
	}

	function renderTracks() {
		if (!map || !L || !layerGroup || !dataset || !summary) return;
		layerGroup.clearLayers();

		const visible = visiblePointsAtTime(dataset, appState.currentTimeMs, appState.tailMode);
		for (const [id, points] of visible) {
			if (points.length === 0) continue;
			const color = colorForIndividual(id, summary.individualIds);
			const latlngs: Leaflet.LatLngExpression[] = points.map((p) => [p.lat, p.lon]);

			if (points.length > 1) {
				L.polyline(latlngs, { color, weight: 2, opacity: 0.8 }).addTo(layerGroup);
			}
			const head = points[points.length - 1];
			L.circleMarker([head.lat, head.lon], {
				radius: 6,
				color,
				fillColor: color,
				fillOpacity: 1
			})
				.bindTooltip(id)
				.addTo(layerGroup);
		}
	}

	// Re-render tracks whenever dataset, time, or trail mode changes.
	$effect(() => {
		dataset;
		appState.currentTimeMs;
		appState.tailMode;
		renderTracks();
	});

	$effect(() => {
		if (!map || !tileLayers) return;
		for (const [id, layer] of Object.entries(tileLayers)) {
			if (id === appState.basemap) {
				if (!map.hasLayer(layer)) layer.addTo(map);
			} else {
				map.removeLayer(layer);
			}
		}
	});

	function formatDistance(km: number): string {
		return km >= 1000 ? `${(km / 1000).toFixed(1)}k km` : `${km.toFixed(1)} km`;
	}
</script>

<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
	<h2 class="text-lg font-semibold text-slate-100">Map preview & time-lapse</h2>

	{#if !dataset}
		<p class="mt-2 text-sm text-slate-400">Load a dataset first to see the map.</p>
	{:else}
		<div class="mt-4 grid grid-cols-3 gap-3 text-center">
			<div class="rounded-lg bg-slate-900/60 p-3">
				<p class="text-xs tracking-wide text-slate-500 uppercase">Individuals active</p>
				<p class="text-xl font-semibold text-slate-100">{metrics?.activeIndividuals ?? 0}</p>
			</div>
			<div class="rounded-lg bg-slate-900/60 p-3">
				<p class="text-xs tracking-wide text-slate-500 uppercase">Distance so far</p>
				<p class="text-xl font-semibold text-slate-100">
					{formatDistance(metrics?.cumulativeDistanceKm ?? 0)}
				</p>
			</div>
			<div class="rounded-lg bg-slate-900/60 p-3">
				<p class="text-xs tracking-wide text-slate-500 uppercase">Total points</p>
				<p class="text-xl font-semibold text-slate-100">{summary?.totalPoints ?? 0}</p>
			</div>
		</div>

		<div bind:this={mapEl} class="mt-4 h-[420px] w-full rounded-lg"></div>

		<div class="mt-4">
			<TimelineControls />
		</div>
	{/if}
</section>
