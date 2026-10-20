<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '$lib/state.svelte';
	import {
		renderSosFrame,
		getBasemapImage,
		preloadBasemaps,
		SOS_WIDTH,
		SOS_HEIGHT
	} from '$lib/sosRenderer';
	import { BASEMAPS, SOS_BASEMAP_OPTIONS, type SosBasemapId } from '$lib/basemaps';
	import { CanvasVideoRecorder, downloadBlob } from '$lib/videoRecorder';
	import TimelineControls from './TimelineControls.svelte';

	let canvasEl = $state<HTMLCanvasElement>();
	let recorder: CanvasVideoRecorder | null = null;
	let recording = $state(false);
	let recordError = $state<string | null>(null);
	let basemapLoadedVersion = $state(0);

	const dataset = $derived(appState.dataset);
	const summary = $derived(appState.summary);
	const currentAttribution = $derived(
		appState.sosBasemap !== 'none' ? BASEMAPS[appState.sosBasemap]?.attribution : ''
	);

	onMount(() => {
		preloadBasemaps();
	});

	$effect(() => {
		if (!canvasEl || !dataset || !summary) return;

		// Track reactivity
		const basemapId = appState.sosBasemap;
		appState.currentTimeMs;
		appState.tailMode;
		basemapLoadedVersion;

		const img = getBasemapImage(basemapId, () => {
			basemapLoadedVersion++;
		});

		renderSosFrame(
			canvasEl,
			dataset,
			appState.currentTimeMs,
			appState.tailMode,
			summary.individualIds,
			basemapId,
			img
		);
	});

	function handleBasemapChange(e: Event) {
		const target = e.currentTarget as HTMLSelectElement;
		const val = target.value as SosBasemapId;
		appState.sosBasemap = val;
		if (val !== 'none') {
			appState.basemap = val;
		}
	}

	async function toggleRecording() {
		if (!canvasEl) return;
		recordError = null;

		if (recording) {
			try {
				const blob = await recorder?.stop();
				if (blob) downloadBlob(blob, 'sos_preview.webm');
			} catch (err) {
				recordError = err instanceof Error ? err.message : 'Recording failed.';
			} finally {
				recording = false;
			}
			return;
		}

		try {
			recorder = new CanvasVideoRecorder(canvasEl, 30);
			recorder.start();
			recording = true;
		} catch (err) {
			recordError =
				err instanceof Error ? err.message : 'Could not start recording in this browser.';
			recording = false;
		}
	}
</script>

<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
	<h2 class="text-lg font-semibold text-slate-100">Science on a Sphere preview</h2>
	<p class="mt-1 text-sm text-slate-400">
		2:1 Plate Carrée (EPSG:4326) render spanning -180°..180° longitude and -90°..90° latitude —
		exactly what the SOS operator's software expects.
	</p>

	{#if !dataset}
		<p class="mt-2 text-sm text-slate-400">Load a dataset first to render the SOS preview.</p>
	{:else}
		<div class="mt-4 overflow-hidden rounded-lg border border-slate-700 bg-black">
			<canvas bind:this={canvasEl} width={SOS_WIDTH} height={SOS_HEIGHT} class="aspect-[2/1] w-full"
			></canvas>
		</div>

		<!-- Controls below canvas: Basemap dropdown & Record button -->
		<div class="mt-4 flex flex-wrap items-center justify-between gap-4">
			<div class="flex flex-wrap items-center gap-2">
				<label for="sos-basemap-select" class="text-sm font-medium text-slate-300">
					Basemap:
				</label>
				<select
					id="sos-basemap-select"
					value={appState.sosBasemap}
					onchange={handleBasemapChange}
					class="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
				>
					{#each SOS_BASEMAP_OPTIONS as opt (opt.id)}
						<option value={opt.id}>{opt.label}</option>
					{/each}
				</select>
				{#if currentAttribution}
					<span class="text-xs text-slate-500">{currentAttribution}</span>
				{/if}
			</div>

			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={toggleRecording}
					class="rounded-md px-4 py-1.5 text-sm font-medium text-white transition-colors"
					class:bg-red-700={recording}
					class:hover:bg-red-600={recording}
					class:bg-emerald-700={!recording}
					class:hover:bg-emerald-600={!recording}
				>
					{recording ? 'Stop & download' : 'Record SOS preview video'}
				</button>
				<span class="text-xs text-slate-500">Press Play on the timeline below, then record.</span>
			</div>
		</div>

		{#if recordError}
			<p class="mt-3 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{recordError}</p>
		{/if}

		<div class="mt-4">
			<TimelineControls />
		</div>
	{/if}
</section>
