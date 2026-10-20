<script lang="ts">
	import { appState, type WizardStep } from '$lib/state.svelte';
	import DataUpload from '$lib/components/DataUpload.svelte';
	import MovebankSearch from '$lib/components/MovebankSearch.svelte';
	import MapPreview from '$lib/components/MapPreview.svelte';
	import SosStudio from '$lib/components/SosStudio.svelte';
	import QgisExporter from '$lib/components/QgisExporter.svelte';

	const steps: { id: WizardStep; label: string }[] = [
		{ id: 'data', label: '1. Get data' },
		{ id: 'map', label: '2. Map & time-lapse' },
		{ id: 'sos', label: '3. SOS studio' },
		{ id: 'export', label: '4. QGIS hand-off' }
	];

	const dataset = $derived(appState.dataset);
</script>

<svelte:head>
	<title>Movebank → Science on a Sphere</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	<header class="mb-6">
		<h1 class="text-2xl font-bold text-slate-100">Movebank → Science on a Sphere</h1>
		<p class="mt-1 text-sm text-slate-400">
			Upload animal movement data, preview it on a map, render an SOS-ready globe animation, and
			export a hand-off package for QGIS — no GIS experience required.
		</p>
	</header>

	<nav class="mb-6 flex flex-wrap gap-2 border-b border-slate-700 pb-4">
		{#each steps as step (step.id)}
			<button
				type="button"
				onclick={() => (appState.step = step.id)}
				disabled={step.id !== 'data' && !dataset}
				class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-sky-700={appState.step === step.id}
				class:text-white={appState.step === step.id}
				class:text-slate-300={appState.step !== step.id}
				class:hover:bg-slate-700={appState.step !== step.id}
			>
				{step.label}
			</button>
		{/each}
		{#if dataset}
			<button
				type="button"
				onclick={() => appState.reset()}
				class="ml-auto rounded-full px-4 py-1.5 text-sm text-slate-400 hover:text-red-300"
			>
				Start over
			</button>
		{/if}
	</nav>

	<div class="space-y-6">
		{#if appState.step === 'data'}
			<DataUpload />
			<MovebankSearch />
		{:else if appState.step === 'map'}
			<MapPreview />
		{:else if appState.step === 'sos'}
			<SosStudio />
		{:else if appState.step === 'export'}
			<QgisExporter />
		{/if}
	</div>
</div>
