import type { Dataset, DatasetSource, TrackPoint } from './types';

/** Parses CSV text into rows of string cells, honoring quoted fields with embedded commas/newlines. */
export function parseCsvRows(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
			continue;
		}
		if (c === '"') {
			inQuotes = true;
		} else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\r') {
			// ignore, \n handles line breaks
		} else if (c === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += c;
		}
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function normalizeHeader(h: string): string {
	return h.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
}

/** Candidate header names (normalized) mapped to canonical fields we care about. */
const HEADER_ALIASES: Record<string, string[]> = {
	timestamp: ['timestamp', 'study-local-timestamp', 'date', 'datetime'],
	lat: ['location-lat', 'lat', 'latitude', 'location-latitude'],
	lon: ['location-long', 'location-lon', 'lon', 'long', 'longitude', 'location-longitude'],
	individualId: [
		'individual-local-identifier',
		'individual-id',
		'individual_id',
		'tag-local-identifier',
		'individual'
	],
	species: ['individual-taxon-canonical-name', 'species', 'taxon-canonical-name']
};

function buildColumnIndex(header: string[]): Record<string, number> {
	const normalized = header.map(normalizeHeader);
	const index: Record<string, number> = {};
	for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
		for (const alias of aliases) {
			const i = normalized.indexOf(alias);
			if (i !== -1) {
				index[field] = i;
				break;
			}
		}
	}
	return index;
}

function toEpochMs(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	// Movebank timestamps look like "2015-05-13 23:45:00.000"; normalize to ISO.
	const isoLike = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T') + 'Z';
	const ms = Date.parse(isoLike);
	if (!Number.isNaN(ms)) return ms;
	const fallback = Date.parse(trimmed);
	return Number.isNaN(fallback) ? null : fallback;
}

export interface ParseOptions {
	source: DatasetSource;
	species?: string;
	studyId?: string;
	studyName?: string;
	licenseType?: string;
	/** Fallback individual id used when no individual column is present. */
	defaultIndividualId?: string;
}

/** Parses a Movebank-style (or generic lat/long/timestamp) CSV into a Dataset. */
export function parseTrackCsv(text: string, opts: ParseOptions): Dataset {
	const rows = parseCsvRows(text);
	if (rows.length < 2) {
		throw new Error('CSV file has no data rows.');
	}
	const [header, ...body] = rows;
	const col = buildColumnIndex(header);

	if (col.lat === undefined || col.lon === undefined || col.timestamp === undefined) {
		throw new Error(
			'CSV is missing required columns. Expected timestamp, location-lat and location-long (or similar).'
		);
	}

	const points: TrackPoint[] = [];
	let detectedSpecies = opts.species;

	for (const cells of body) {
		const lat = Number.parseFloat(cells[col.lat]);
		const lon = Number.parseFloat(cells[col.lon]);
		const timestampMs = toEpochMs(cells[col.timestamp] ?? '');
		if (!Number.isFinite(lat) || !Number.isFinite(lon) || timestampMs === null) continue;

		const individualId =
			(col.individualId !== undefined ? cells[col.individualId] : undefined)?.trim() ||
			opts.defaultIndividualId ||
			'individual-1';

		if (!detectedSpecies && col.species !== undefined) {
			detectedSpecies = cells[col.species]?.trim() || undefined;
		}

		points.push({ individualId, timestampMs, lat, lon });
	}

	if (points.length === 0) {
		throw new Error('No valid rows found in CSV (check latitude/longitude/timestamp values).');
	}

	return {
		id: crypto.randomUUID(),
		studyId: opts.studyId,
		studyName: opts.studyName,
		species: detectedSpecies ?? 'Unknown species',
		source: opts.source,
		licenseType: opts.licenseType,
		points
	};
}

/** Parses a GeoJSON FeatureCollection of Point features into a Dataset. */
export function parseTrackGeoJson(text: string, opts: ParseOptions): Dataset {
	const json = JSON.parse(text);
	const features: unknown[] = Array.isArray(json?.features) ? json.features : [];
	if (features.length === 0) {
		throw new Error('GeoJSON has no features.');
	}

	const points: TrackPoint[] = [];
	let detectedSpecies = opts.species;

	for (const raw of features) {
		const feature = raw as {
			geometry?: { type?: string; coordinates?: [number, number] };
			properties?: Record<string, unknown>;
		};
		if (feature.geometry?.type !== 'Point' || !feature.geometry.coordinates) continue;
		const [lon, lat] = feature.geometry.coordinates;
		const props = feature.properties ?? {};
		const timestampRaw = (props.timestamp ?? props.date ?? props.datetime) as string | undefined;
		const timestampMs = timestampRaw ? toEpochMs(String(timestampRaw)) : null;
		if (!Number.isFinite(lat) || !Number.isFinite(lon) || timestampMs === null) continue;

		const individualId = (props.individual_id ??
			props.individualId ??
			props['individual-local-identifier']) as string | undefined;

		if (!detectedSpecies && typeof props.species === 'string') {
			detectedSpecies = props.species;
		}

		points.push({
			individualId: individualId?.toString().trim() || opts.defaultIndividualId || 'individual-1',
			timestampMs,
			lat,
			lon
		});
	}

	if (points.length === 0) {
		throw new Error('No valid Point features with timestamp found in GeoJSON.');
	}

	return {
		id: crypto.randomUUID(),
		studyId: opts.studyId,
		studyName: opts.studyName,
		species: detectedSpecies ?? 'Unknown species',
		source: opts.source,
		licenseType: opts.licenseType,
		points
	};
}

/** Parses an uploaded File (CSV or GeoJSON) into a Dataset, inferring format from name/content. */
export async function parseUploadedFile(file: File): Promise<Dataset> {
	const text = await file.text();
	const name = file.name.toLowerCase();
	const opts: ParseOptions = {
		source: 'upload',
		studyName: file.name.replace(/\.[^.]+$/, '')
	};

	if (name.endsWith('.json') || name.endsWith('.geojson') || text.trim().startsWith('{')) {
		return parseTrackGeoJson(text, opts);
	}
	return parseTrackCsv(text, opts);
}
