<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { parseUploadedFile, parseTrackCsv } from '$lib/parse';
	import { listSampleDatasets, sampleFileUrl, type SampleDataset } from '$lib/samples';

	let error = $state<string | null>(null);
	let loadingSample = $state<string | null>(null);
	let dragOver = $state(false);
	let samples = $state<SampleDataset[]>([]);
	let samplesError = $state<string | null>(null);
	let sampleTermsAccepted = $state(false);

	$effect(() => {
		listSampleDatasets()
			.then((list) => (samples = list))
			.catch((err) => {
				samplesError = err instanceof Error ? err.message : 'Could not load sample list.';
			});
	});

	async function handleFiles(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		error = null;
		try {
			const dataset = await parseUploadedFile(file);
			appState.setDataset(dataset);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not read that file.';
		}
	}

	function onInputChange(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		handleFiles(target.files);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		handleFiles(e.dataTransfer?.files ?? null);
	}

	async function loadSample(sample: SampleDataset) {
		error = null;
		loadingSample = sample.file;
		try {
			const res = await fetch(sampleFileUrl(sample.file));
			if (!res.ok) throw new Error(`Could not load sample file (${res.status})`);
			const text = await res.text();
			const dataset = parseTrackCsv(text, {
				source: 'sample',
				species: sample.species,
				studyName: sample.label
			});
			appState.setDataset(dataset);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load sample dataset.';
		} finally {
			loadingSample = null;
		}
	}
</script>

<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
	<h2 class="text-lg font-semibold text-slate-100">1. Upload Movebank data</h2>
	<p class="mt-1 text-sm text-slate-400">
		Download a study from <a
			href="https://www.movebank.org"
			target="_blank"
			rel="noreferrer"
			class="underline hover:text-slate-200">movebank.org</a
		> (CSV or GeoJSON export), then drop it here. Everything stays in your browser — nothing is uploaded
		to a server.
	</p>

	<label
		for="file-input"
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={onDrop}
		class="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors"
		class:border-sky-400={dragOver}
		class:bg-sky-950={dragOver}
		class:border-slate-600={!dragOver}
	>
		<span class="text-sm text-slate-300"
			>Drag & drop a .csv or .geojson file here, or click to browse</span
		>
		<input
			id="file-input"
			type="file"
			accept=".csv,.json,.geojson,text/csv,application/json"
			class="sr-only"
			onchange={onInputChange}
		/>
	</label>

	{#if error}
		<p class="mt-3 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
	{/if}

	<div class="mt-6">
		<h3 class="text-sm font-medium text-slate-200">Or load a real Movebank dataset on file:</h3>
		{#if !sampleTermsAccepted}
			<div class="mt-2 rounded-lg border border-amber-700 bg-amber-950/40 p-4">
				<p class="text-sm text-amber-200">
					These example datasets are real Movebank downloads kept in this project's folder and
					are subject to each study's Data Use Agreement. By continuing you agree to respect the
					<a
						href="https://www.movebank.org/cms/movebank-content/movebank-terms-of-use"
						target="_blank"
						rel="noreferrer"
						class="underline">Movebank Terms of Use</a
					> and any study-specific license terms.
				</p>
				<button
					type="button"
					onclick={() => (sampleTermsAccepted = true)}
					class="mt-3 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
				>
					I agree, let me use an example dataset
				</button>
			</div>
		{:else if samplesError}
			<p class="mt-2 text-sm text-red-300">{samplesError}</p>
		{:else if samples.length === 0}
			<p class="mt-2 text-sm text-slate-500">No sample datasets found yet.</p>
		{:else}
			<ul class="mt-2 divide-y divide-slate-700 overflow-hidden rounded-lg border border-slate-700">
				{#each samples as sample (sample.file)}
					<li class="flex items-center justify-between gap-3 bg-slate-900/60 p-3">
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-slate-100">{sample.label}</p>
							{#if sample.species}
								<p class="truncate text-xs text-slate-400">{sample.species}</p>
							{/if}
						</div>
						<button
							type="button"
							onclick={() => loadSample(sample)}
							disabled={loadingSample !== null}
							class="shrink-0 rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-400 hover:text-sky-300 disabled:opacity-50"
						>
							{loadingSample === sample.file ? 'Loading…' : 'Load'}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="mt-2 text-xs text-slate-500">
			These are real Movebank downloads added to this project's folder. Do not download or use
			without permission.
		</p>
	</div>
</section>
