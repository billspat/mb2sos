import type { Dataset } from './types';
import { summarizeDataset } from './geo';
import type { DatasetSummary } from './types';

export type WizardStep = 'data' | 'map' | 'sos' | 'export';
export type TailMode = 'full' | 'fading' | 'current';
export type BasemapId = 'osm' | 'esri-satellite' | 'esri-ocean';

/** Central reactive app state shared across modules/components (client-only, SSR disabled). */
class AppState {
	dataset = $state<Dataset | null>(null);
	step = $state<WizardStep>('data');

	// playback / timeline
	currentTimeMs = $state(0);
	playing = $state(false);
	speedMultiplier = $state(10);
	tailMode = $state<TailMode>('fading');
	basemap = $state<BasemapId>('osm');

	summary = $derived<DatasetSummary | null>(this.dataset ? summarizeDataset(this.dataset) : null);

	setDataset(dataset: Dataset) {
		this.dataset = dataset;
		const s = summarizeDataset(dataset);
		this.currentTimeMs = s.startMs;
		this.playing = false;
		this.step = 'map';
	}

	reset() {
		this.dataset = null;
		this.step = 'data';
		this.currentTimeMs = 0;
		this.playing = false;
	}
}

export const appState = new AppState();
