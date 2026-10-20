<script lang="ts">
	import { appState } from '$lib/state.svelte';

	const summary = $derived(appState.summary);
	const speeds = [1, 10, 100, 1000];

	let rafId: number | null = null;
	let lastFrameMs: number | null = null;

	function tick(now: number) {
		if (appState.playing && summary) {
			if (lastFrameMs !== null) {
				const realDeltaMs = now - lastFrameMs;
				const simDeltaMs = realDeltaMs * appState.speedMultiplier;
				let next = appState.currentTimeMs + simDeltaMs;
				if (next >= summary.endMs) {
					next = summary.startMs;
				}
				appState.currentTimeMs = next;
			}
			lastFrameMs = now;
			rafId = requestAnimationFrame(tick);
		} else {
			lastFrameMs = null;
		}
	}

	$effect(() => {
		if (appState.playing) {
			lastFrameMs = null;
			rafId = requestAnimationFrame(tick);
		}
		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	});

	function togglePlay() {
		appState.playing = !appState.playing;
	}

	function onScrub(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		appState.currentTimeMs = Number(input.value);
		appState.playing = false;
	}

	function formatTime(ms: number): string {
		if (!Number.isFinite(ms)) return '—';
		return new Date(ms).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
	}
</script>

{#if summary}
	<div class="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				onclick={togglePlay}
				class="rounded-md bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-600"
			>
				{appState.playing ? 'Pause' : 'Play'}
			</button>

			<label class="flex items-center gap-2 text-sm text-slate-300">
				Speed
				<select
					bind:value={appState.speedMultiplier}
					class="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
				>
					{#each speeds as s (s)}
						<option value={s}>{s}x</option>
					{/each}
				</select>
			</label>

			<label class="flex items-center gap-2 text-sm text-slate-300">
				Trail
				<select
					bind:value={appState.tailMode}
					class="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
				>
					<option value="full">Full trajectory</option>
					<option value="fading">Fading tail (14 days)</option>
					<option value="current">Current position only</option>
				</select>
			</label>

			<span class="ml-auto font-mono text-sm text-slate-200"
				>{formatTime(appState.currentTimeMs)}</span
			>
		</div>

		<input
			type="range"
			min={summary.startMs}
			max={summary.endMs}
			step={60000}
			value={appState.currentTimeMs}
			oninput={onScrub}
			class="mt-3 w-full accent-sky-500"
		/>
	</div>
{/if}
