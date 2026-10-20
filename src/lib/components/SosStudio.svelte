<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { renderSosFrame, SOS_WIDTH, SOS_HEIGHT, SOS_BASEMAPS } from '$lib/sosRenderer';
	import { CanvasVideoRecorder, downloadBlob } from '$lib/videoRecorder';
	import TimelineControls from './TimelineControls.svelte';

	let canvasEl = $state<HTMLCanvasElement>();
	let recorder: CanvasVideoRecorder | null = null;
	let recording = $state(false);
	let recordError = $state<string | null>(null);
	let basemapImages = new Map<string, HTMLImageElement>();
	let basemapLoaded = $state(0); // bump to trigger a re-render once an image finishes loading

	const dataset = $derived(appState.dataset);
	const summary = $derived(appState.summary);
	const activeBasemapImage = $derived.by(() => {
		basemapLoaded; // track
		return basemapImages.get(appState.sosBasemap) ?? null;
	});

	$effect(() => {
		for (const basemap of SOS_BASEMAPS) {
			if (basemapImages.has(basemap.id)) continue;
			const img = new Image();
			img.onload = () => (basemapLoaded += 1);
			img.src = basemap.url;
			basemapImages.set(basemap.id, img);
		}
	});

	$effect(() => {
		if (!canvasEl || !dataset || !summary) return;
		// re-render whenever time, trail mode, basemap, or dataset changes;
		// `basemapLoaded` is read explicitly so a late image load triggers a redraw
		// even though `activeBasemapImage` keeps the same object reference.
		basemapLoaded;
		renderSosFrame(
			canvasEl,
			dataset,
			appState.currentTimeMs,
			appState.tailMode,
			summary.individualIds,
			activeBasemapImage
		);
	});

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

		<div class="mt-4 flex items-center gap-3">
			<button
				type="button"
				onclick={toggleRecording}
				class="rounded-md px-4 py-1.5 text-sm font-medium text-white"
				class:bg-red-700={recording}
				class:hover:bg-red-600={recording}
				class:bg-emerald-700={!recording}
				class:hover:bg-emerald-600={!recording}
			>
				{recording ? 'Stop & download' : 'Record SOS preview video'}
			</button>
			<label class="flex items-center gap-2 text-sm text-slate-300">
				Basemap
				<select
					bind:value={appState.sosBasemap}
					class="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
				>
					<option value="none">None</option>
					{#each SOS_BASEMAPS as basemap (basemap.id)}
						<option value={basemap.id}>{basemap.label}</option>
					{/each}
				</select>
			</label>
			<span class="text-xs text-slate-500">Press Play on the timeline below, then record.</span>
		</div>

		{#if recordError}
			<p class="mt-3 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{recordError}</p>
		{/if}

		<div class="mt-4">
			<TimelineControls />
		</div>
	{/if}
</section>
