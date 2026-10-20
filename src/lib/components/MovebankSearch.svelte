<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import type { MovebankStudySummary, Dataset, TrackPoint } from '$lib/types';

	let termsAccepted = $state(false);
	let species = $state('');
	let username = $state('');
	let password = $state('');
	let searching = $state(false);
	let searchError = $state<string | null>(null);
	let studies = $state<MovebankStudySummary[]>([]);
	let loadingStudyId = $state<string | null>(null);

	async function search() {
		searching = true;
		searchError = null;
		studies = [];
		try {
			const params = new URLSearchParams({ species });
			if (username) params.set('username', username);
			if (password) params.set('password', password);
			const res = await fetch(`/api/movebank/search?${params.toString()}`);
			const data = await res.json();
			if (!res.ok || data.error) {
				throw new Error(data.error ?? `Search failed (${res.status})`);
			}
			studies = data.studies ?? [];
			if (studies.length === 0) {
				searchError =
					'No downloadable studies matched that species. Try a broader name, or use a sample dataset below.';
			}
		} catch (err) {
			searchError =
				err instanceof Error
					? err.message
					: 'Could not reach Movebank. Try again later or use a sample dataset.';
		} finally {
			searching = false;
		}
	}

	async function loadStudy(study: MovebankStudySummary) {
		loadingStudyId = study.studyId;
		searchError = null;
		try {
			const params = new URLSearchParams({ study_id: study.studyId });
			if (username) params.set('username', username);
			if (password) params.set('password', password);
			const res = await fetch(`/api/movebank/events?${params.toString()}`);
			const data = await res.json();
			if (!res.ok || data.error) {
				throw new Error(data.error ?? `Could not fetch events (${res.status})`);
			}
			const events: { timestamp: string; lat: number; lon: number; individualId?: string }[] =
				data.events ?? [];
			if (events.length === 0) throw new Error('This study returned no event data.');

			const points: TrackPoint[] = events.map((e) => ({
				individualId: e.individualId?.trim() || 'individual-1',
				timestampMs: Date.parse(e.timestamp),
				lat: e.lat,
				lon: e.lon
			}));

			const dataset: Dataset = {
				id: crypto.randomUUID(),
				studyId: study.studyId,
				studyName: study.studyName,
				species: study.species || species,
				source: 'movebank',
				licenseType: study.licenseType,
				points
			};
			appState.setDataset(dataset);
		} catch (err) {
			searchError = err instanceof Error ? err.message : 'Could not load that study.';
		} finally {
			loadingStudyId = null;
		}
	}
</script>

<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
	<h2 class="text-lg font-semibold text-slate-100">2. Or search Movebank directly</h2>
	<p class="mt-1 text-sm text-slate-400">
		Live search can be slow or empty for many species — public, download-ready studies are limited.
		Upload is usually faster for class activities.
	</p>

	{#if !termsAccepted}
		<div class="mt-4 rounded-lg border border-amber-700 bg-amber-950/40 p-4">
			<p class="text-sm text-amber-200">
				Movebank data is subject to each study's Data Use Agreement. By continuing you agree to
				respect the <a
					href="https://www.movebank.org/cms/movebank-content/movebank-terms-of-use"
					target="_blank"
					rel="noreferrer"
					class="underline">Movebank Terms of Use</a
				> and any study-specific license terms.
			</p>
			<button
				type="button"
				onclick={() => (termsAccepted = true)}
				class="mt-3 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
			>
				I agree, let me search
			</button>
		</div>
	{:else}
		<div class="mt-4 flex flex-wrap gap-2">
			<input
				type="text"
				bind:value={species}
				placeholder="Species, e.g. Panthera leo"
				class="min-w-48 flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
			/>
			<button
				type="button"
				onclick={search}
				disabled={searching || !species.trim()}
				class="rounded-md bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
			>
				{searching ? 'Searching…' : 'Search'}
			</button>
		</div>

		<details class="mt-3 text-sm text-slate-400">
			<summary class="cursor-pointer"
				>Optional Movebank credentials (for restricted studies)</summary
			>
			<div class="mt-2 flex flex-wrap gap-2">
				<input
					type="text"
					bind:value={username}
					placeholder="Username"
					autocomplete="username"
					class="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
				/>
				<input
					type="password"
					bind:value={password}
					placeholder="Password"
					autocomplete="current-password"
					class="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
				/>
			</div>
			<p class="mt-1 text-xs text-slate-500">
				Credentials are sent directly to Movebank through this app's server for one request and are
				never stored.
			</p>
		</details>

		{#if searchError}
			<p class="mt-3 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{searchError}</p>
		{/if}

		{#if studies.length > 0}
			<ul class="mt-4 divide-y divide-slate-700 overflow-hidden rounded-lg border border-slate-700">
				{#each studies as study (study.studyId)}
					<li class="flex items-center justify-between gap-3 bg-slate-900/60 p-3">
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-slate-100">{study.studyName}</p>
							<p class="truncate text-xs text-slate-400">
								{study.species || 'unknown species'} · {study.numberOfEvents} events · {study.licenseType ||
									'license n/a'}
							</p>
						</div>
						<button
							type="button"
							onclick={() => loadStudy(study)}
							disabled={loadingStudyId !== null}
							class="shrink-0 rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-400 hover:text-sky-300 disabled:opacity-50"
						>
							{loadingStudyId === study.studyId ? 'Loading…' : 'Use this study'}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>
