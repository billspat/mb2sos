export interface SampleDataset {
	file: string;
	label: string;
	species?: string;
}

/** Fetches the generated manifest of real Movebank CSVs available in static/samples. */
export async function listSampleDatasets(): Promise<SampleDataset[]> {
	const res = await fetch('/samples/manifest.json');
	if (!res.ok) throw new Error(`Could not load sample dataset list (${res.status}).`);
	return res.json();
}

export function sampleFileUrl(file: string): string {
	return `/samples/${encodeURIComponent(file)}`;
}
