import type { Dataset, DatasetSummary, TrackPoint } from './types';

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometers (Haversine formula). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return EARTH_RADIUS_KM * c;
}

/** Groups points by individual, each sorted chronologically. */
export function groupByIndividual(points: TrackPoint[]): Map<string, TrackPoint[]> {
	const map = new Map<string, TrackPoint[]>();
	for (const p of points) {
		const list = map.get(p.individualId);
		if (list) list.push(p);
		else map.set(p.individualId, [p]);
	}
	for (const list of map.values()) {
		list.sort((a, b) => a.timestampMs - b.timestampMs);
	}
	return map;
}

/** Computes bounding box, temporal extent, and cumulative distances for a dataset. */
export function summarizeDataset(dataset: Dataset): DatasetSummary {
	const byIndividual = groupByIndividual(dataset.points);
	const distanceKmByIndividual: Record<string, number> = {};

	let minLat = Infinity;
	let maxLat = -Infinity;
	let minLon = Infinity;
	let maxLon = -Infinity;
	let startMs = Infinity;
	let endMs = -Infinity;

	for (const [id, pts] of byIndividual) {
		let dist = 0;
		for (let i = 0; i < pts.length; i++) {
			const p = pts[i];
			minLat = Math.min(minLat, p.lat);
			maxLat = Math.max(maxLat, p.lat);
			minLon = Math.min(minLon, p.lon);
			maxLon = Math.max(maxLon, p.lon);
			startMs = Math.min(startMs, p.timestampMs);
			endMs = Math.max(endMs, p.timestampMs);
			if (i > 0) {
				dist += haversineKm(pts[i - 1].lat, pts[i - 1].lon, p.lat, p.lon);
			}
		}
		distanceKmByIndividual[id] = dist;
	}

	const totalDistanceKm = Object.values(distanceKmByIndividual).reduce((a, b) => a + b, 0);

	return {
		individualIds: [...byIndividual.keys()].sort(),
		startMs: Number.isFinite(startMs) ? startMs : 0,
		endMs: Number.isFinite(endMs) ? endMs : 0,
		minLat: Number.isFinite(minLat) ? minLat : -90,
		maxLat: Number.isFinite(maxLat) ? maxLat : 90,
		minLon: Number.isFinite(minLon) ? minLon : -180,
		maxLon: Number.isFinite(maxLon) ? maxLon : 180,
		totalPoints: dataset.points.length,
		distanceKmByIndividual,
		totalDistanceKm
	};
}

/** Deterministic color per individual id, picked from a readable categorical palette. */
const PALETTE = [
	'#e6194b',
	'#3cb44b',
	'#4363d8',
	'#f58231',
	'#911eb4',
	'#46f0f0',
	'#f032e6',
	'#bcf60c',
	'#fabebe',
	'#008080',
	'#e6beff',
	'#9a6324'
];

export function colorForIndividual(id: string, allIds: string[]): string {
	const idx = allIds.indexOf(id);
	return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
}

const FADING_TAIL_MS = 14 * 24 * 60 * 60 * 1000;

/** Points visible for each individual at a given playback time, respecting the trail mode. */
export function visiblePointsAtTime(
	dataset: Dataset,
	currentTimeMs: number,
	tailMode: 'full' | 'fading' | 'current'
): Map<string, TrackPoint[]> {
	const byIndividual = groupByIndividual(dataset.points);
	const result = new Map<string, TrackPoint[]>();

	for (const [id, pts] of byIndividual) {
		const upToNow = pts.filter((p) => p.timestampMs <= currentTimeMs);
		if (upToNow.length === 0) continue;

		if (tailMode === 'current') {
			result.set(id, [upToNow[upToNow.length - 1]]);
		} else if (tailMode === 'fading') {
			const cutoff = currentTimeMs - FADING_TAIL_MS;
			result.set(
				id,
				upToNow.filter((p) => p.timestampMs >= cutoff)
			);
		} else {
			result.set(id, upToNow);
		}
	}
	return result;
}

export interface PlaybackMetrics {
	activeIndividuals: number;
	cumulativeDistanceKm: number;
}

/** Active individual count and cumulative distance traveled, up to the given playback time. */
export function metricsAtTime(dataset: Dataset, currentTimeMs: number): PlaybackMetrics {
	const byIndividual = groupByIndividual(dataset.points);
	let activeIndividuals = 0;
	let cumulativeDistanceKm = 0;

	for (const pts of byIndividual.values()) {
		const upToNow = pts.filter((p) => p.timestampMs <= currentTimeMs);
		if (upToNow.length === 0) continue;
		activeIndividuals++;
		for (let i = 1; i < upToNow.length; i++) {
			cumulativeDistanceKm += haversineKm(
				upToNow[i - 1].lat,
				upToNow[i - 1].lon,
				upToNow[i].lat,
				upToNow[i].lon
			);
		}
	}
	return { activeIndividuals, cumulativeDistanceKm };
}
